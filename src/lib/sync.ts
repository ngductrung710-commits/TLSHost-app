import "server-only";

import { parseIcal, type VEvent } from "@/lib/ical";
import { withOrg } from "@/lib/db";

/**
 * Pulling one channel's feed into the calendar.
 *
 * The dangerous half of this is not writing new blocks — it is removing old
 * ones. A block that should be there and is not means the room looks free on
 * every other channel, and the next guest to book it is a double booking the
 * host finds out about from an angry message. So deletions are guarded twice,
 * and both guards prefer keeping a stale block over removing a live one:
 * a night wrongly held costs one empty night, a night wrongly freed costs a
 * guest.
 */

/** A feed returning nothing is treated as a fault, not as "everything freed". */
const EMPTY_FEED_IS_A_FAULT = true;

/**
 * Above this share of a channel's blocks disappearing at once, hold them all.
 *
 * A real week clears a few reservations. Half of them vanishing in one sync is
 * what a changed listing id, a revoked URL, or an OTA outage looks like — all
 * of which return an intact document with the wrong contents, so nothing
 * cheaper than this notices.
 */
const BULK_DELETE_SHARE = 0.4;
/** Below this many, the share is meaningless — three of five is not a signal. */
const BULK_DELETE_FLOOR = 5;

/**
 * Runs one statement so that its failure does not poison the transaction.
 *
 * Postgres aborts the entire transaction on any error: every statement after a
 * failed one returns 25P02 until the block ends. So the obvious shape here —
 * try the insert, catch the constraint violation, carry on with the next event
 * — does not work. It silently converts one conflicting reservation into a
 * whole sync run that writes nothing, which is exactly the failure this
 * function exists to prevent.
 *
 * A savepoint scopes the rollback to the one statement. ROLLBACK TO SAVEPOINT
 * is one of the few commands an aborted transaction still accepts, which is
 * what makes recovery possible at all.
 *
 * Found by a check script: a feed whose moved event overlapped another event in
 * the same feed took the whole run down with it.
 */
async function tryStatement(
  tx: { $executeRawUnsafe: (sql: string) => Promise<unknown> },
  name: string,
  run: () => Promise<unknown>,
): Promise<boolean> {
  await tx.$executeRawUnsafe(`SAVEPOINT ${name}`);
  try {
    await run();
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${name}`);
    return true;
  } catch {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${name}`);
    return false;
  }
}

export type SyncOutcome = {
  status: "OK" | "FAILED" | "HELD";
  eventsSeen: number;
  eventsApplied: number;
  eventsRemoved: number;
  heldDeletions: number;
  error: string | null;
};

/** Fetch with a timeout: an OTA that never answers must not wedge the worker. */
async function fetchFeed(url: string, timeoutMs = 20_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Máy chủ kênh trả về ${res.status}`);

    const text = await res.text();
    // A login page or an error page is still a 200. Anything that is not a
    // calendar must not be parsed into "zero events", which is the input the
    // empty-feed guard exists to catch — better to fail loudly here.
    if (!text.includes("BEGIN:VCALENDAR")) {
      throw new Error("Nội dung trả về không phải lịch iCal");
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function syncChannel({
  orgId,
  channelId,
  fetchImpl = fetchFeed,
}: {
  orgId: string;
  channelId: string;
  /** Injected by the tests so they can feed a document without a server. */
  fetchImpl?: (url: string) => Promise<string>;
}): Promise<SyncOutcome> {
  const channel = await withOrg(orgId, (tx) =>
    tx.channel.findUnique({
      where: { id: channelId },
      select: { id: true, roomId: true, importUrl: true, kind: true },
    }),
  );

  if (!channel) {
    return {
      status: "FAILED",
      eventsSeen: 0,
      eventsApplied: 0,
      eventsRemoved: 0,
      heldDeletions: 0,
      error: "Không tìm thấy kênh này.",
    };
  }

  let events: VEvent[];
  let skipped = 0;
  try {
    const parsed = parseIcal(await fetchImpl(channel.importUrl));
    events = parsed.events;
    skipped = parsed.skipped;
  } catch (error) {
    return {
      status: "FAILED",
      eventsSeen: 0,
      eventsApplied: 0,
      eventsRemoved: 0,
      heldDeletions: 0,
      error: error instanceof Error ? error.message : "Không tải được lịch.",
    };
  }

  return withOrg(orgId, async (tx) => {
    // Lock the room for the length of this transaction. Everything below reads
    // the room's bookings once and decides against that snapshot, so a direct
    // booking arriving mid-sync must wait rather than slip between the read and
    // the write.
    await tx.$executeRaw`SELECT id FROM room WHERE id = ${channel.roomId} FOR UPDATE`;

    // The exclusion constraints are per-table: block_no_overlap catches a feed
    // event landing on another feed event, and nothing catches one landing on a
    // direct booking. Without this check an OTA reservation imports straight
    // over a guest who booked with the host — which is the exact double booking
    // the whole design exists to prevent, arriving through the one door that
    // was left open. Found by a check script; the constraint alone let it
    // through.
    const heldByBookings = await tx.booking.findMany({
      where: { roomId: channel.roomId, status: { not: "CANCELLED" } },
      select: { checkIn: true, checkOut: true },
    });

    const clashesWithBooking = (from: Date, to: Date) =>
      heldByBookings.some(
        (b) => b.checkIn < to && b.checkOut > from,
      );

    const existing = await tx.block.findMany({
      where: { channelId: channel.id },
      select: { id: true, externalUid: true, dateFrom: true, dateTo: true },
    });

    const byUid = new Map(
      existing
        .filter((b): b is typeof b & { externalUid: string } =>
          b.externalUid !== null,
        )
        .map((b) => [b.externalUid, b]),
    );

    const seenUids = new Set(events.map((e) => e.uid));
    const gone = existing.filter(
      (b) => b.externalUid === null || !seenUids.has(b.externalUid),
    );

    /* ---- guard one: an empty feed frees nothing ---------------------- */
    if (EMPTY_FEED_IS_A_FAULT && events.length === 0 && existing.length > 0) {
      await tx.channel.update({
        where: { id: channel.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncOk: false,
          heldDeletions: gone.length,
        },
      });
      return {
        status: "HELD" as const,
        eventsSeen: 0,
        eventsApplied: 0,
        eventsRemoved: 0,
        heldDeletions: gone.length,
        error:
          `Kênh trả về lịch rỗng trong khi đang giữ ${existing.length} khoảng. ` +
          `Giữ nguyên tất cả — nhiều khả năng link đã hỏng chứ không phải khách đã hủy hết.`,
      };
    }

    /* ---- guard two: a bulk disappearance is held ---------------------- */
    const share = existing.length === 0 ? 0 : gone.length / existing.length;
    const bulk =
      gone.length >= BULK_DELETE_FLOOR && share >= BULK_DELETE_SHARE;

    /* ---- apply the additions and moves, always ----------------------- */
    let applied = 0;
    /** Events the calendar refused: they overlap something already held. */
    let conflicts = 0;
    // Savepoint names must be unique within the transaction; derived from a
    // plain counter rather than from the tallies, which can repeat.
    let step = 0;
    for (const event of events) {
      step += 1;
      const match = byUid.get(event.uid);

      if (clashesWithBooking(event.start, event.end)) {
        // A direct booking already holds these nights. Left alone and counted:
        // if that booking is cancelled the nights free up and this lands on the
        // next sync. Overwriting it would be choosing the OTA's version of the
        // truth over the host's.
        conflicts += 1;
        continue;
      }

      if (!match) {
        // A new reservation. It can still collide with another event in the
        // same feed, which the exclusion constraint refuses — a conflict worth
        // showing rather than papering over.
        const ok = await tryStatement(tx, `sp_${step}`, () =>
          tx.block.create({
            data: {
              orgId,
              roomId: channel.roomId,
              dateFrom: event.start,
              dateTo: event.end,
              reason: "CHANNEL_SYNC",
              note: event.summary,
              channelId: channel.id,
              externalUid: event.uid,
            },
          }),
        );
        if (ok) applied += 1;
        else conflicts += 1;
        continue;
      }

      const moved =
        match.dateFrom.getTime() !== event.start.getTime() ||
        match.dateTo.getTime() !== event.end.getTime();

      if (moved) {
        const ok = await tryStatement(tx, `sp_${step}`, () =>
          tx.block.update({
            where: { id: match.id },
            data: {
              dateFrom: event.start,
              dateTo: event.end,
              note: event.summary,
            },
          }),
        );
        if (ok) applied += 1;
        else conflicts += 1;
      }
    }

    /* ---- then the removals, if they were not held -------------------- */
    let removed = 0;
    let held = 0;

    if (bulk) {
      held = gone.length;
    } else if (gone.length > 0) {
      const result = await tx.block.deleteMany({
        where: { id: { in: gone.map((b) => b.id) } },
      });
      removed = result.count;
    }

    await tx.channel.update({
      where: { id: channel.id },
      data: {
        lastSyncAt: new Date(),
        lastSyncOk: !bulk,
        heldDeletions: held,
      },
    });

    return {
      status: bulk ? ("HELD" as const) : ("OK" as const),
      eventsSeen: events.length + skipped,
      eventsApplied: applied,
      eventsRemoved: removed,
      heldDeletions: held,
      error: bulk
        ? `${gone.length} trong ${existing.length} khoảng biến mất cùng lúc — ` +
          `giữ nguyên để bạn kiểm tra. Đồng bộ lại nếu đúng là khách đã hủy.`
        : [
            conflicts > 0
              ? `${conflicts} khoảng trùng với lượt đặt đã có, chưa nhận được.`
              : null,
            skipped > 0 ? `Bỏ qua ${skipped} sự kiện không đọc được.` : null,
          ]
            .filter(Boolean)
            .join(" ") || null,
    };
  });
}

/** Runs a sync and records it. The UI and the worker both go through this. */
export async function runSync({
  orgId,
  channelId,
  fetchImpl,
}: {
  orgId: string;
  channelId: string;
  fetchImpl?: (url: string) => Promise<string>;
}): Promise<SyncOutcome> {
  const run = await withOrg(orgId, (tx) =>
    tx.syncRun.create({
      data: { orgId, channelId, status: "RUNNING" },
      select: { id: true },
    }),
  );

  const outcome = await syncChannel({ orgId, channelId, fetchImpl });

  await withOrg(orgId, (tx) =>
    tx.syncRun.update({
      where: { id: run.id },
      data: {
        status: outcome.status,
        finishedAt: new Date(),
        eventsSeen: outcome.eventsSeen,
        eventsApplied: outcome.eventsApplied,
        eventsRemoved: outcome.eventsRemoved,
        heldDeletions: outcome.heldDeletions,
        error: outcome.error,
      },
    }),
  );

  return outcome;
}
