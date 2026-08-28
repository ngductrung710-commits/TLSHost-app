// Exercises the half of the assistant that changes things.
//
//   npm run check:proposals
//
// The model call is not tested here — it needs a key, and it is the harmless
// half anyway: it produces a row and stops. What matters is that approving a
// row goes through the same guards a host's own click goes through, and that a
// proposal describing something impossible is refused rather than applied.
//
// Proposals are inserted directly, which is also the adversarial case: it is
// exactly what a compromised or confused model would produce, and the answer
// has to be the same either way.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { applyProposal } from "../.tmp/applyProposal.mjs";

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

const ORG = "check-prop-org";
const OTHER = "check-prop-other";
const ROOM = "check-prop-room";
const OTHER_ROOM = "check-prop-other-room";

const withOrg = (orgId, fn) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });

const member = {
  orgId: ORG,
  membershipId: "check-prop-m",
  userId: "check-prop-u",
  role: "OWNER",
  canEditOthersBookings: true,
  scopedPropertyIds: [],
  userName: "Chu nha",
  email: "x@example.com",
  orgName: "Check",
  timezone: "Asia/Ho_Chi_Minh",
};

const bookings = () =>
  withOrg(ORG, (tx) =>
    tx.booking.findMany({
      where: { status: { not: "CANCELLED" } },
      select: { guestName: true, roomId: true, checkIn: true, checkOut: true },
      orderBy: { checkIn: "asc" },
    }),
  );

// Runs before and after. The `user` row is the easy one to forget — it hangs
// off nothing this script deletes, so leaving it behind made the second run
// fail on a duplicate key. A check that only passes once is not a check.
async function cleanup() {
  for (const id of [ORG, OTHER]) {
    await prisma.$executeRaw`DELETE FROM organization WHERE id = ${id}`;
  }
  for (const id of [ROOM, OTHER_ROOM]) {
    await prisma.$executeRaw`DELETE FROM room WHERE id = ${id}`;
  }
  await prisma.$executeRaw`DELETE FROM "user" WHERE id = 'check-prop-u'`;
}

try {
  await cleanup();

  for (const [org, prop, room] of [
    [ORG, "check-prop-p", ROOM],
    [OTHER, "check-prop-other-p", OTHER_ROOM],
  ]) {
    await prisma.$executeRaw`INSERT INTO organization (id, name, "updatedAt") VALUES (${org}, 'Check', now())`;
    await withOrg(org, (tx) =>
      tx.property.create({
        data: {
          id: prop,
          orgId: org,
          name: "P",
          rooms: { create: { id: room, orgId: org, name: "R", capacity: 4 } },
        },
      }),
    );
  }

  await withOrg(ORG, (tx) =>
    tx.user.create({ data: { id: "check-prop-u", email: "cp@example.com", name: "U" } }),
  );
  await withOrg(ORG, async (tx) => {
    await tx.membership.create({
      data: { id: "check-prop-m", orgId: ORG, userId: "check-prop-u", role: "OWNER", joinedAt: new Date() },
    });
  });

  const apply = (payload) => applyProposal({ member, raw: payload });

  /* ------------------------------------------------------------------ */
  console.log("\n-- an ordinary booking proposal");
  let r = await apply({
    kind: "CREATE_BOOKING", roomId: ROOM,
    checkIn: "2027-03-10", checkOut: "2027-03-13",
    guestName: "Khach A", guestEmail: "", guestPhone: "", guests: 2,
    source: "DIRECT", notes: "",
  });
  check("applied", r, { ok: true });
  check("one booking, 3 nights", (await bookings()).map((b) =>
    Math.round((b.checkOut - b.checkIn) / 86400000)), [3]);

  /* ------------------------------------------------------------------ */
  console.log("\n-- the same nights again");
  r = await apply({
    kind: "CREATE_BOOKING", roomId: ROOM,
    checkIn: "2027-03-11", checkOut: "2027-03-14",
    guestName: "Khach B", guestEmail: "", guestPhone: "", guests: 2,
    source: "DIRECT", notes: "",
  });
  check("refused", r.ok, false);
  check("names the conflict", /Khach A/.test(r.error), true);
  check("still one booking", (await bookings()).length, 1);

  /* ------------------------------------------------------------------ */
  console.log("\n-- back to back, the day the last one ends");
  r = await apply({
    kind: "CREATE_BOOKING", roomId: ROOM,
    checkIn: "2027-03-13", checkOut: "2027-03-15",
    guestName: "Khach C", guestEmail: "", guestPhone: "", guests: 2,
    source: "DIRECT", notes: "",
  });
  check("applied", r, { ok: true });
  check("two bookings", (await bookings()).length, 2);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a room belonging to another organization");
  r = await apply({
    kind: "CREATE_BOOKING", roomId: OTHER_ROOM,
    checkIn: "2027-05-01", checkOut: "2027-05-03",
    guestName: "Ke gia mao", guestEmail: "", guestPhone: "", guests: 2,
    source: "DIRECT", notes: "",
  });
  check("refused", r.ok, false);
  check("no booking written anywhere",
    await prisma.$queryRaw`SELECT count(*)::int AS n FROM booking WHERE "guestName" = 'Ke gia mao'`,
    [{ n: 0 }]);

  /* ------------------------------------------------------------------ */
  console.log("\n-- an invented room id");
  r = await apply({
    kind: "CREATE_BOOKING", roomId: "khong-ton-tai",
    checkIn: "2027-06-01", checkOut: "2027-06-03",
    guestName: "X", guestEmail: "", guestPhone: "", guests: 2,
    source: "DIRECT", notes: "",
  });
  check("refused", [r.ok, r.error], [false, "Phòng trong đề xuất không còn tồn tại."]);

  /* ------------------------------------------------------------------ */
  console.log("\n-- backwards dates");
  r = await apply({
    kind: "CREATE_BOOKING", roomId: ROOM,
    checkIn: "2027-07-10", checkOut: "2027-07-05",
    guestName: "X", guestEmail: "", guestPhone: "", guests: 2,
    source: "DIRECT", notes: "",
  });
  check("refused", [r.ok, r.error], [false, "Ngày trong đề xuất không hợp lệ."]);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a payload that is not a valid proposal at all");
  check("refused", (await apply({ kind: "DROP_TABLES", sql: "delete from booking" })).ok, false);
  check("refused", (await apply(null)).ok, false);
  check("refused", (await apply({ kind: "CREATE_BOOKING", roomId: ROOM })).ok, false);
  check("nothing changed", (await bookings()).length, 2);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a block over an existing booking");
  r = await apply({
    kind: "BLOCK_NIGHTS", roomId: ROOM,
    dateFrom: "2027-03-11", dateTo: "2027-03-12",
    reason: "MAINTENANCE", note: "",
  });
  check("refused", r.ok, false);
  check("no block written",
    await withOrg(ORG, (tx) => tx.block.count()), 0);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a block on free nights");
  r = await apply({
    kind: "BLOCK_NIGHTS", roomId: ROOM,
    dateFrom: "2027-04-01", dateTo: "2027-04-04",
    reason: "MAINTENANCE", note: "Son lai",
  });
  check("applied", r, { ok: true });

  /* ------------------------------------------------------------------ */
  console.log("\n-- moving a booking onto the other one");
  const first = await withOrg(ORG, (tx) =>
    tx.booking.findFirst({ where: { guestName: "Khach A" }, select: { id: true } }));
  r = await apply({
    kind: "MOVE_BOOKING", bookingId: first.id, roomId: ROOM,
    checkIn: "2027-03-13", checkOut: "2027-03-16",
  });
  check("refused", r.ok, false);
  check("names the conflict", /Khach C/.test(r.error), true);

  /* ------------------------------------------------------------------ */
  console.log("\n-- moving it somewhere free (and not colliding with itself)");
  r = await apply({
    kind: "MOVE_BOOKING", bookingId: first.id, roomId: ROOM,
    checkIn: "2027-03-09", checkOut: "2027-03-13",
  });
  check("applied", r, { ok: true });
  const moved = await withOrg(ORG, (tx) =>
    tx.booking.findUnique({ where: { id: first.id }, select: { checkIn: true, checkOut: true } }));
  check("new dates stored",
    [moved.checkIn.toISOString().slice(0, 10), moved.checkOut.toISOString().slice(0, 10)],
    ["2027-03-09", "2027-03-13"]);

  /* ------------------------------------------------------------------ */
  console.log("\n-- setting and clearing a price");
  check("set", await apply({ kind: "SET_PRICE", roomId: ROOM, basePrice: 1600000 }), { ok: true });
  check("stored", (await withOrg(ORG, (tx) =>
    tx.room.findUnique({ where: { id: ROOM }, select: { basePrice: true } }))).basePrice, 1600000);
  check("clear", await apply({ kind: "SET_PRICE", roomId: ROOM, basePrice: null }), { ok: true });
  check("cleared", (await withOrg(ORG, (tx) =>
    tx.room.findUnique({ where: { id: ROOM }, select: { basePrice: true } }))).basePrice, null);

  /* ------------------------------------------------------------------ */
  console.log("\n-- cancelling, then cancelling again");
  check("cancelled", await apply({ kind: "CANCEL_BOOKING", bookingId: first.id }), { ok: true });
  check("second time refused",
    (await apply({ kind: "CANCEL_BOOKING", bookingId: first.id })).error,
    "Đặt phòng này đã được hủy trước đó.");
  check("its nights are free again", (await bookings()).length, 1);

  /* ------------------------------------------------------------------ */
  console.log("\n-- NONE has nothing to apply");
  check("refused", (await apply({ kind: "NONE", why: "thiếu ngày" })).ok, false);

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
} finally {
  await cleanup();
  await prisma.$disconnect();
}

process.exit(failures === 0 ? 0 : 1);
