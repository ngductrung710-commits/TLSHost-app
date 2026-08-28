import "server-only";

import { type Prisma } from "@prisma/client";

/**
 * The one check the database cannot make on its own.
 *
 * An exclusion constraint works within a single table, so booking-vs-booking
 * and block-vs-block are already impossible (see the guarantees migration).
 * A booking and a block landing on the same night is just as wrong and spans
 * two tables, which no single constraint can cover — so it is checked here.
 *
 * Being application code, this one *does* have a race, and it is closed the
 * only way that works: by taking a lock first. See `lockRoom` below.
 */

export type Conflict = {
  kind: "booking" | "block";
  id: string;
  label: string;
  from: Date;
  to: Date;
};

export class NightsTakenError extends Error {
  readonly conflicts: Conflict[];

  constructor(conflicts: Conflict[]) {
    super("Những đêm này đã có người giữ");
    this.name = "NightsTakenError";
    this.conflicts = conflicts;
  }
}

/** A transaction handle from `withOrg`. */
type Tx = Prisma.TransactionClient;

/**
 * Serialises everyone asking about the same room.
 *
 * Without this, two requests both read "free" and both insert. The exclusion
 * constraints would still catch a booking-vs-booking collision, but nothing
 * would catch a booking racing a block — one of them would win and the other
 * would be written on top of it.
 *
 * The lock is on the room row and released when the transaction ends, so it is
 * held for the length of one insert. Two people booking *different* rooms never
 * wait for each other, which is the case that actually happens.
 */
async function lockRoom(tx: Tx, roomId: string): Promise<void> {
  await tx.$executeRaw`SELECT id FROM room WHERE id = ${roomId} FOR UPDATE`;
}

/**
 * Throws NightsTakenError if anything already holds [from, to) on this room.
 *
 * Half-open on both sides: a stay ending on the 15th and one starting on the
 * 15th do not conflict. Expressed as `start < to AND end > from`, which is the
 * same test daterange && performs, written so Prisma can index it.
 *
 * `ignoreBookingId` exists for edits — a booking being moved must not be found
 * to collide with the version of itself still in the table.
 */
export async function assertNightsFree(
  tx: Tx,
  {
    roomId,
    from,
    to,
    ignoreBookingId,
    ignoreBlockId,
  }: {
    roomId: string;
    from: Date;
    to: Date;
    ignoreBookingId?: string;
    ignoreBlockId?: string;
  },
): Promise<void> {
  await lockRoom(tx, roomId);

  // Sequential, not Promise.all. A transaction holds one connection, so the
  // two queries cannot actually run at the same time — `pg` just serialises
  // them and warns that doing this is deprecated and breaks in pg@9. There was
  // never any parallelism to lose.
  const bookings = await tx.booking.findMany({
    where: {
      roomId,
      status: { not: "CANCELLED" },
      checkIn: { lt: to },
      checkOut: { gt: from },
      ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
    },
    select: { id: true, guestName: true, checkIn: true, checkOut: true },
    orderBy: { checkIn: "asc" },
  });

  const blocks = await tx.block.findMany({
    where: {
      roomId,
      dateFrom: { lt: to },
      dateTo: { gt: from },
      ...(ignoreBlockId ? { id: { not: ignoreBlockId } } : {}),
    },
    select: { id: true, reason: true, dateFrom: true, dateTo: true },
    orderBy: { dateFrom: "asc" },
  });

  const conflicts: Conflict[] = [
    ...bookings.map((b): Conflict => ({
      kind: "booking",
      id: b.id,
      label: b.guestName,
      from: b.checkIn,
      to: b.checkOut,
    })),
    ...blocks.map((b): Conflict => ({
      kind: "block",
      id: b.id,
      label: BLOCK_LABELS[b.reason],
      from: b.dateFrom,
      to: b.dateTo,
    })),
  ];

  if (conflicts.length > 0) throw new NightsTakenError(conflicts);
}

const BLOCK_LABELS: Record<string, string> = {
  MAINTENANCE: "Bảo trì",
  OWNER_STAY: "Chủ nhà ở",
  CHANNEL_SYNC: "Đã bán trên kênh khác",
  OTHER: "Đã khóa",
};
