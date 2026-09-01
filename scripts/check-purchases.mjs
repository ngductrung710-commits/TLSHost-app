// Confirming a payment, against the real database.
//
//   npm run check:purchases
//
// One question, and it is the expensive one: can a single transfer buy two
// months? A confirm button gets double-clicked, a job gets retried, an
// operator comes back the next day unsure whether they already did it. If any
// of those adds a second month, the product gives away plan time and nothing
// anywhere reports a problem — the row looks paid either way.
//
// The guard is a conditional update, so it has to be tested against a real
// Postgres rather than a mock: the whole claim is about what happens when two
// statements race for one row, and a mock will happily agree with whatever the
// code does.
//
// Creates its own organization and deletes it at the end, so it is safe to run
// against a database with real data in it.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { applyPurchase, createPurchase } from "../.tmp/purchases.mjs";

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

const ORG = "check-purchases-org";

const withOrg = (fn) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ORG}, true)`;
    return fn(tx);
  });

const cleanup = async () => {
  await prisma.$executeRaw`DELETE FROM organization WHERE id = ${ORG}`;
};

const orgRow = () =>
  prisma.$queryRaw`SELECT plan, "planUntil" FROM organization WHERE id = ${ORG}`.then(
    (rows) => rows[0],
  );

const iso = (d) => (d === null ? null : new Date(d).toISOString().slice(0, 10));

try {
  await cleanup();
  await prisma.$executeRaw`INSERT INTO organization (id, name, "updatedAt") VALUES (${ORG}, 'Purchase check', now())`;

  const now = new Date("2026-06-10T00:00:00.000Z");

  /* ------------------------------------------------------------------ */
  console.log("-- a purchase changes nothing until it is confirmed");

  const first = await withOrg((tx) =>
    createPurchase(tx, ORG, "PRO", { plan: "FREE", planUntil: null }),
  );
  check("a reference was allocated", /^TLS[A-Z2-9]{7}$/.test(first.reference), true);
  check("priced at one month of PRO", first.amount, 690_000);

  let org = await orgRow();
  check("the org is still on FREE", org.plan, "FREE");
  check("…with no end date", org.planUntil, null);

  /* ------------------------------------------------------------------ */
  console.log("\n-- confirming it extends the plan");

  const applied = await withOrg((tx) => applyPurchase(tx, first.id, now));
  check("applied", applied.ok, true);
  org = await orgRow();
  check("now on PRO", org.plan, "PRO");
  check("for one calendar month", iso(org.planUntil), "2026-07-10");

  /* ------------------------------------------------------------------ */
  console.log("\n-- confirming the same one again buys nothing");

  const again = await withOrg((tx) => applyPurchase(tx, first.id, now));
  check("refused", again, { ok: false, reason: "ALREADY_SETTLED" });
  org = await orgRow();
  check("the end date did not move", iso(org.planUntil), "2026-07-10");

  // And a third time, from a later clock — the shape a retried job actually
  // has, where the second attempt is not simultaneous but hours later.
  const later = await withOrg((tx) =>
    applyPurchase(tx, first.id, new Date("2026-06-11T00:00:00.000Z")),
  );
  check("still refused a day later", later.ok, false);
  check("still 10 July", iso((await orgRow()).planUntil), "2026-07-10");

  /* ------------------------------------------------------------------ */
  console.log("\n-- two confirmations racing for one row");

  const second = await withOrg((tx) =>
    createPurchase(tx, ORG, "PRO", { plan: "PRO", planUntil: new Date("2026-07-10") }),
  );
  // Both transactions start before either commits, which is the case a
  // check-then-update cannot survive and a conditional update can.
  const [a, b] = await Promise.all([
    withOrg((tx) => applyPurchase(tx, second.id, now)),
    withOrg((tx) => applyPurchase(tx, second.id, now)),
  ]);
  check("exactly one of them won", [a.ok, b.ok].filter(Boolean).length, 1);
  check("one month added, not two", iso((await orgRow()).planUntil), "2026-08-10");

  /* ------------------------------------------------------------------ */
  console.log("\n-- buying while still inside a month adds to the end");

  const third = await withOrg((tx) =>
    createPurchase(tx, ORG, "PRO", { plan: "PRO", planUntil: new Date("2026-08-10") }),
  );
  await withOrg((tx) => applyPurchase(tx, third.id, now));
  check("extends from 10 August, not from today", iso((await orgRow()).planUntil), "2026-09-10");

  /* ------------------------------------------------------------------ */
  console.log("\n-- changing plan resets rather than inheriting the old date");

  const channels = await withOrg((tx) =>
    createPurchase(tx, ORG, "CHANNELS", { plan: "PRO", planUntil: new Date("2026-09-10") }),
  );
  await withOrg((tx) => applyPurchase(tx, channels.id, now));
  org = await orgRow();
  check("now on CHANNELS", org.plan, "CHANNELS");
  check("a month from today, not from the PRO end date", iso(org.planUntil), "2026-07-10");

  /* ------------------------------------------------------------------ */
  console.log("\n-- an unlimited grant is not capped by a purchase");

  const refused = await withOrg((tx) =>
    createPurchase(tx, ORG, "PRO", { plan: "PRO", planUntil: null }),
  );
  check("no purchase is opened at all", refused, null);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a purchase that does not exist is not an exception");

  const missing = await withOrg((tx) => applyPurchase(tx, "no-such-purchase", now));
  check("reported, not thrown", missing, { ok: false, reason: "NOT_FOUND" });

  /* ------------------------------------------------------------------ */
  console.log("\n-- references are unique across many purchases");

  const refs = new Set();
  for (let i = 0; i < 200; i++) {
    const p = await withOrg((tx) =>
      createPurchase(tx, ORG, "PRO", { plan: "FREE", planUntil: null }),
    );
    refs.add(p.reference);
  }
  check("200 purchases, 200 distinct references", refs.size, 200);
} finally {
  await cleanup();
  await prisma.$disconnect();
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
