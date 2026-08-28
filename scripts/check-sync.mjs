// Exercises the channel sync against the real database, with the feed injected
// rather than fetched.
//
//   npm run check:sync
//
// What is actually being tested is the deletion guards. Everything else here is
// setup for them: a block wrongly kept costs one empty night, a block wrongly
// removed costs a double booking, so the guards must fail toward keeping.
//
// Creates its own organization and deletes it at the end, so it can be run
// against a database with real data in it.
//
// The npm script passes --env-file rather than calling loadEnvFile here: ESM
// hoists imports, and src/lib/db.ts throws at module scope without
// DATABASE_URL, so any load inside this file would run too late.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { runSync } from "../.tmp/sync.mjs";

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

const ORG = "check-sync-org";
const ROOM = "check-sync-room";
const CHANNEL = "check-sync-channel";

const withOrg = (fn) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ORG}, true)`;
    return fn(tx);
  });

/** Builds a feed holding the given [start, end) ranges. */
const feed = (ranges) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    ...ranges.flatMap(([uid, from, to]) => [
      "BEGIN:VEVENT",
      `UID:${uid}@test`,
      `DTSTART;VALUE=DATE:${from}`,
      `DTEND;VALUE=DATE:${to}`,
      "SUMMARY:Reserved",
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");

const serve = (text) => async () => text;

const blocks = () =>
  withOrg((tx) =>
    tx.block.findMany({
      where: { channelId: CHANNEL },
      select: { externalUid: true, dateFrom: true, dateTo: true },
      orderBy: { dateFrom: "asc" },
    }),
  );

const uids = async () =>
  (await blocks()).map((b) => b.externalUid.replace("@test", ""));

async function cleanup() {
  await prisma.$executeRaw`DELETE FROM organization WHERE id = ${ORG}`;
  await prisma.$executeRaw`DELETE FROM room WHERE id = ${ROOM}`;
}

try {
  await cleanup();

  await prisma.$executeRaw`INSERT INTO organization (id, name, "updatedAt") VALUES (${ORG}, 'Sync check', now())`;
  await withOrg(async (tx) => {
    await tx.property.create({
      data: {
        id: "check-sync-prop",
        orgId: ORG,
        name: "P",
        rooms: { create: { id: ROOM, name: "R" } },
      },
    });
    await tx.channel.create({
      data: {
        id: CHANNEL,
        orgId: ORG,
        roomId: ROOM,
        kind: "AIRBNB",
        importUrl: "https://example.invalid/feed.ics",
      },
    });
  });

  /* ------------------------------------------------------------------ */
  console.log("\n-- first sync: ten reservations arrive");
  let r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    fetchImpl: serve(feed(Array.from({ length: 10 }, (_, i) => {
      const day = String(i * 3 + 1).padStart(2, "0");
      const end = String(i * 3 + 3).padStart(2, "0");
      return [`e${i}`, `202611${day}`, `202611${end}`];
    }))),
  });
  check("ten applied", [r.status, r.eventsApplied, r.eventsRemoved], ["OK", 10, 0]);
  check("ten blocks exist", (await blocks()).length, 10);
  check("DTEND exclusive — 2 nights each",
        (await blocks()).map((b) => Math.round((b.dateTo - b.dateFrom) / 86400000)),
        Array(10).fill(2));

  /* ------------------------------------------------------------------ */
  console.log("\n-- second sync: identical feed, nothing should change");
  r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    fetchImpl: serve(feed(Array.from({ length: 10 }, (_, i) => {
      const day = String(i * 3 + 1).padStart(2, "0");
      const end = String(i * 3 + 3).padStart(2, "0");
      return [`e${i}`, `202611${day}`, `202611${end}`];
    }))),
  });
  check("idempotent: nothing applied or removed",
        [r.status, r.eventsApplied, r.eventsRemoved], ["OK", 0, 0]);
  check("still ten blocks, no duplicates", (await blocks()).length, 10);

  /* ------------------------------------------------------------------ */
  console.log("\n-- third sync: one cancellation — an ordinary removal");
  r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    fetchImpl: serve(feed(Array.from({ length: 9 }, (_, i) => {
      const day = String(i * 3 + 1).padStart(2, "0");
      const end = String(i * 3 + 3).padStart(2, "0");
      return [`e${i}`, `202611${day}`, `202611${end}`];
    }))),
  });
  check("one removed, not held", [r.status, r.eventsRemoved, r.heldDeletions], ["OK", 1, 0]);
  check("nine blocks left", (await blocks()).length, 9);

  /* ------------------------------------------------------------------ */
  console.log("\n-- GUARD 1: the feed comes back empty");
  r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    fetchImpl: serve(feed([])),
  });
  check("held, nothing removed", [r.status, r.eventsRemoved], ["HELD", 0]);
  check("all nine blocks kept", (await blocks()).length, 9);
  check("held count reported", r.heldDeletions, 9);

  /* ------------------------------------------------------------------ */
  console.log("\n-- GUARD 2: two thirds of the feed disappears at once");
  r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    fetchImpl: serve(feed(Array.from({ length: 3 }, (_, i) => {
      const day = String(i * 3 + 1).padStart(2, "0");
      const end = String(i * 3 + 3).padStart(2, "0");
      return [`e${i}`, `202611${day}`, `202611${end}`];
    }))),
  });
  check("held, nothing removed", [r.status, r.eventsRemoved], ["HELD", 0]);
  check("all nine blocks kept", (await blocks()).length, 9);
  check("six deletions held", r.heldDeletions, 6);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a normal sync afterwards still works");
  r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    fetchImpl: serve(feed(Array.from({ length: 8 }, (_, i) => {
      const day = String(i * 3 + 1).padStart(2, "0");
      const end = String(i * 3 + 3).padStart(2, "0");
      return [`e${i}`, `202611${day}`, `202611${end}`];
    }))),
  });
  check("one removal goes through", [r.status, r.eventsRemoved], ["OK", 1]);
  check("eight blocks left", (await blocks()).length, 8);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a reservation is moved, not cancelled");
  const keep = (n) =>
    Array.from({ length: n }, (_, i) => {
      const day = String((i + 1) * 3 + 1).padStart(2, "0");
      const end = String((i + 1) * 3 + 3).padStart(2, "0");
      return [`e${i + 1}`, `202611${day}`, `202611${end}`];
    });

  r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    // December, so the new range lands somewhere nothing else holds. The first
    // attempt moved it onto e7 and turned this into an overlap test by
    // accident — which is how the transaction-abort bug surfaced. That case now
    // has its own check below.
    fetchImpl: serve(feed([["e0", "20261226", "20261229"], ...keep(7)])),
  });
  check("moved in place, nothing removed",
        [r.status, r.eventsApplied, r.eventsRemoved], ["OK", 1, 0]);
  const moved = (await blocks()).find((b) => b.externalUid === "e0@test");
  check("new range stored",
        [moved.dateFrom.toISOString().slice(0, 10), moved.dateTo.toISOString().slice(0, 10)],
        ["2026-12-26", "2026-12-29"]);
  check("still eight blocks", (await blocks()).length, 8);

  /* ------------------------------------------------------------------ */
  // Without savepoints, one refused statement aborts the whole transaction and
  // every event after it fails with 25P02 — so a single overlap silently costs
  // the entire run. This is the check that proves it does not.
  console.log("\n-- one event overlaps another in the same feed");
  r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    fetchImpl: serve(feed([
      ["e0", "20261226", "20261229"],
      ...keep(7),
      ["overlap", "20261122", "20261124"],  // sits on top of e7
      ["after", "20261215", "20261217"],    // free, and comes after the refusal
    ])),
  });
  check("the overlapping event is refused", (await uids()).includes("overlap"), false);
  check("the event AFTER the refusal still lands", (await uids()).includes("after"), true);
  check("the run survives, one applied", [r.status, r.eventsApplied], ["OK", 1]);
  check("nine blocks now", (await blocks()).length, 9);

  /* ------------------------------------------------------------------ */
  console.log("\n-- a feed event colliding with a direct booking");
  await withOrg((tx) =>
    tx.booking.create({
      data: {
        orgId: ORG, roomId: ROOM, guestName: "Khách trực tiếp",
        checkIn: new Date("2026-12-10"), checkOut: new Date("2026-12-14"),
      },
    }),
  );
  r = await runSync({
    orgId: ORG, channelId: CHANNEL,
    fetchImpl: serve(feed([
      ["e0", "20261226", "20261229"],
      ...keep(7),
      ["after", "20261215", "20261217"],
      ["clash", "20261211", "20261213"],
    ])),
  });
  check("the clash is not written", (await uids()).includes("clash"), false);
  check("the other nine survive", (await blocks()).length, 9);
  check("the direct booking is untouched",
        (await withOrg((tx) => tx.booking.count({ where: { status: "CONFIRMED" } }))), 1);

  /* ------------------------------------------------------------------ */
  console.log("\n-- the run log");
  const runs = await withOrg((tx) =>
    tx.syncRun.findMany({
      where: { channelId: CHANNEL },
      select: { status: true, eventsRemoved: true, heldDeletions: true },
      orderBy: { startedAt: "asc" },
    }),
  );
  check("every run recorded", runs.length, 9);
  check("statuses in order", runs.map((x) => x.status),
        ["OK", "OK", "OK", "HELD", "HELD", "OK", "OK", "OK", "OK"]);

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
} finally {
  await cleanup();
  await prisma.$disconnect();
}

process.exit(failures === 0 ? 0 : 1);
