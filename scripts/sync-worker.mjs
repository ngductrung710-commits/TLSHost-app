// Pulls every active channel, once.
//
//   node --env-file=.env scripts/sync-worker.mjs
//
// Meant to be run on a schedule, out of the web process. Two reasons it is not
// a route the app calls on a timer: fetching a dozen OTA feeds can take a
// minute of mostly waiting, which would occupy a request handler that should be
// answering hosts; and a sync that fails must not be able to take a page down
// with it.
//
// On the VPS this is a PM2 cron entry rather than a long-lived process — there
// is nothing to keep in memory between runs, and a crashed one-shot simply runs
// again on the hour.
//
// Channels are done one at a time on purpose. Each holds a row lock on its room
// for the length of its transaction, and the whole point of the lock is that a
// host booking a room during a sync waits rather than races. Running them in
// parallel would multiply that contention for no gain: the work is almost all
// network wait against different hosts, and a minute either way does not matter
// on an hourly schedule.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { runSync } from "../.tmp/sync.mjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const started = Date.now();
const log = (...parts) =>
  console.log(new Date().toISOString(), ...parts);

/** Runs a query inside a transaction scoped to one organization. */
const withOrg = (orgId, fn) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });

try {
  // Organizations first, then each org's channels from inside its own scope.
  //
  // The obvious version of this — one query joining channel to room across
  // every tenant — returns nothing at all. Row-level security applies to raw
  // SQL exactly as it does to the ORM, so a statement issued outside any org
  // context reads zero rows and the worker reports "0 channels to sync" every
  // hour, forever, without erroring. That is what it did on its first run.
  //
  // `organization` is deliberately the one table with no policy on it, because
  // something has to be able to enumerate tenants. Everything after that stays
  // inside the same boundary the app uses.
  const orgs = await prisma.organization.findMany({ select: { id: true } });

  const channels = [];
  for (const org of orgs) {
    const found = await withOrg(org.id, (tx) =>
      tx.channel.findMany({
        where: { active: true },
        select: { id: true, kind: true, room: { select: { name: true } } },
        orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } },
      }),
    );
    for (const c of found) {
      channels.push({ id: c.id, orgId: org.id, kind: c.kind, room: c.room.name });
    }
  }

  log(`${orgs.length} organizations, ${channels.length} channels to sync`);

  let ok = 0;
  let held = 0;
  let failed = 0;

  for (const channel of channels) {
    try {
      const result = await runSync({
        orgId: channel.orgId,
        channelId: channel.id,
      });

      if (result.status === "OK") ok += 1;
      else if (result.status === "HELD") held += 1;
      else failed += 1;

      log(
        `${channel.kind} / ${channel.room}: ${result.status}`,
        `seen=${result.eventsSeen}`,
        `applied=${result.eventsApplied}`,
        `removed=${result.eventsRemoved}`,
        result.heldDeletions ? `held=${result.heldDeletions}` : "",
        result.error ? `— ${result.error}` : "",
      );
    } catch (error) {
      // One channel's failure must not end the run: the other eleven still
      // need syncing, and a feed that is down now will be up next hour.
      failed += 1;
      log(`${channel.kind} / ${channel.room}: threw —`, error?.message ?? error);
    }
  }

  log(`done in ${Math.round((Date.now() - started) / 1000)}s:`,
      `${ok} ok, ${held} held, ${failed} failed`);

  // Non-zero when something needs a person: PM2 and any log scraper can key on
  // it without parsing the lines above.
  process.exitCode = failed > 0 ? 1 : 0;
} finally {
  await prisma.$disconnect();
}
