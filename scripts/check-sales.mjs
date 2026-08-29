// "Can we take these nights?" — against the real database.
//
//   npm run check:sales
//
// The one that matters is back-to-back. A guest leaving on the 10th and a
// guest arriving on the 10th do not overlap: the room is cleaned and sold
// twice that day, which is the normal, profitable case. An off-by-one in the
// direction of caution silently refuses sellable nights and nobody ever finds
// out, because a room that quietly never appears looks exactly like a room
// that is genuinely busy.
//
// The other direction is worse and is not this file's job: offering a room
// that is already sold. That is held by the exclusion constraint in the
// guarantees migration, and check-sync covers it. This screen only reads.
//
// Creates its own organization and deletes it at the end, so it is safe to run
// against a database with real data in it.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { findVacancies } from "../.tmp/sales.mjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const ORG = "check-sales-org";
const PROP = "check-sales-prop";
const BIG = "check-sales-big";
const SMALL = "check-sales-small";

// What the page passes in. scopedPropertyIds empty means every property.
const member = {
  userId: "check-sales-user",
  userName: "Check",
  email: "check@example.invalid",
  orgId: ORG,
  orgName: "Sales check",
  membershipId: "check-sales-membership",
  role: "OWNER",
  timezone: "Asia/Ho_Chi_Minh",
  scopedPropertyIds: [],
  canEditOthers: true,
};

const day = (iso) => new Date(`${iso}T00:00:00.000Z`);

const free = async (from, to, guests = 1) => {
  const result = await findVacancies(member, { from: day(from), to: day(to), guests });
  return result.vacancies.map((v) => v.roomName).sort();
};

const withOrg = (fn) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ORG}, true)`;
    return fn(tx);
  });

async function cleanup() {
  await prisma.$executeRaw`DELETE FROM organization WHERE id = ${ORG}`;
  await prisma.$executeRaw`DELETE FROM room WHERE "orgId" = ${ORG}`;
}

try {
  await cleanup();

  await prisma.$executeRaw`INSERT INTO organization (id, name, "updatedAt") VALUES (${ORG}, 'Sales check', now())`;

  await withOrg(async (tx) => {
    await tx.property.create({
      data: {
        id: PROP,
        orgId: ORG,
        name: "P",
        rooms: {
          create: [
            { id: BIG, orgId: ORG, name: "Big", capacity: 4, basePrice: 1_000_000 },
            { id: SMALL, orgId: ORG, name: "Small", capacity: 2, basePrice: 500_000 },
          ],
        },
      },
    });

    // Big is sold for the nights of the 10th, 11th and 12th. The guest leaves
    // on the morning of the 13th.
    await tx.booking.create({
      data: {
        orgId: ORG,
        roomId: BIG,
        guestName: "G",
        checkIn: day("2026-10-10"),
        checkOut: day("2026-10-13"),
        guests: 2,
        source: "DIRECT",
      },
    });
  });

  /* ------------------------------------------------------------------ */
  console.log("-- a sold stay hides the room, and only for the nights it covers");

  check("the nights themselves", await free("2026-10-10", "2026-10-13"), ["Small"]);
  check("one night inside it", await free("2026-10-11", "2026-10-12"), ["Small"]);
  check("straddling the start", await free("2026-10-09", "2026-10-11"), ["Small"]);
  check("straddling the end", await free("2026-10-12", "2026-10-14"), ["Small"]);
  check("swallowing it whole", await free("2026-10-01", "2026-11-01"), ["Small"]);

  console.log("\n-- back-to-back is not an overlap");

  // Leaves on the 10th, and someone else arrives on the 10th. Both are real
  // bookings of different nights.
  check("arriving the day they leave", await free("2026-10-13", "2026-10-15"), ["Big", "Small"]);
  check("leaving the day they arrive", await free("2026-10-08", "2026-10-10"), ["Big", "Small"]);
  check("nowhere near it", await free("2026-12-01", "2026-12-03"), ["Big", "Small"]);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a block hides the room the same way a booking does");

  await withOrg((tx) =>
    tx.block.create({
      data: {
        orgId: ORG,
        roomId: SMALL,
        dateFrom: day("2026-11-05"),
        dateTo: day("2026-11-08"),
        reason: "MAINTENANCE",
      },
    }),
  );

  check("inside the block", await free("2026-11-06", "2026-11-07"), ["Big"]);
  check("back-to-back with the block", await free("2026-11-08", "2026-11-09"), ["Big", "Small"]);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a cancelled booking frees its nights");

  await withOrg((tx) =>
    tx.booking.updateMany({ where: { roomId: BIG }, data: { status: "CANCELLED" } }),
  );
  check("the room comes back", await free("2026-10-10", "2026-10-13"), ["Big", "Small"]);

  /* ------------------------------------------------------------------ */
  console.log("\n-- the party has to fit");

  check("two people, both rooms", await free("2026-12-01", "2026-12-03", 2), ["Big", "Small"]);
  check("three, only the big one", await free("2026-12-01", "2026-12-03", 3), ["Big"]);
  check("five, neither", await free("2026-12-01", "2026-12-03", 5), []);

  /* ------------------------------------------------------------------ */
  console.log("\n-- the quote covers the whole stay");

  const quote = await findVacancies(member, {
    from: day("2026-12-01"),
    to: day("2026-12-04"),
    guests: 3,
  });
  check("three nights", quote.nights, 3);
  check("priced per night, not per stay", quote.vacancies[0].total, 3_000_000);
  check("rooms considered", quote.considered, 1);
  check("and how many of them are gone", quote.taken, 0);

  // The update commits before the read. findVacancies opens its own
  // transaction, so doing both inside one withOrg() reads the old row and the
  // check passes for the wrong reason — which is exactly what happened first
  // time and is why this comment is here.
  await withOrg((tx) =>
    tx.room.update({ where: { id: BIG }, data: { basePrice: null } }),
  );
  const unpriced = await findVacancies(member, {
    from: day("2026-12-01"),
    to: day("2026-12-04"),
    guests: 3,
  });
  // A room with no rate is still sellable; it just cannot be quoted. Returning
  // 0 here would put "0 ₫" in front of a guest.
  check("no rate means no total, not a total of zero", unpriced.vacancies[0].total, null);
} finally {
  await cleanup();
  await prisma.$disconnect();
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
