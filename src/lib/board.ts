import "server-only";

import { withOrg } from "@/lib/db";
import { visiblePropertyFilter, type ActiveMember } from "@/lib/dal";
import { addDays, daysBetween } from "@/lib/dates";

/**
 * Everything the board needs for one window of dates, in one round trip.
 *
 * The shape is deliberately flat and already laid out — offsets and spans in
 * columns, not dates — so the component that renders it does arithmetic on
 * integers rather than on Dates. Date maths in a render pass is where
 * off-by-one-day bugs hide.
 */

export type Span = {
  id: string;
  kind: "booking" | "block";
  label: string;
  /** Column index within the window, 0-based. Clamped to 0. */
  offset: number;
  /** Width in columns. Clamped so it never runs past the window. */
  span: number;
  /** True when the stay began before the window: draw a flat left edge. */
  openStart: boolean;
  /** True when it continues past the window. */
  openEnd: boolean;
  nights: number;
  source: string | null;
  createdByMembershipId: string | null;
};

export type BoardRoom = {
  id: string;
  name: string;
  propertyName: string;
  spans: Span[];
};

export type Board = {
  from: Date;
  to: Date;
  days: Date[];
  rooms: BoardRoom[];
  /** Booked nights ÷ available nights across the window, 0–100. */
  occupancy: number;
  /**
   * Per-day: how many rooms are sold, and out of how many.
   *
   * The window average above answers "how is the month"; this answers "which
   * night is empty", which is the one a host can still act on. Blocked nights
   * count in neither — a night held for maintenance is not a night sold, and
   * showing it as one would flatter the number exactly when it should not.
   */
  perDay: { sold: number; total: number }[];
};

export async function loadBoard(
  member: ActiveMember,
  from: Date,
  dayCount: number,
): Promise<Board> {
  const to = addDays(from, dayCount);

  const { rooms, bookings, blocks } = await withOrg(
    member.orgId,
    async (tx) => {
      const rooms = await tx.room.findMany({
        where: { property: visiblePropertyFilter(member) },
        select: {
          id: true,
          name: true,
          property: { select: { name: true } },
        },
        orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
      });

      const roomIds = rooms.map((r) => r.id);

      // An empty `in` list matches nothing, which is correct, but Postgres is
      // asked for it anyway on a fresh account. Skipping the two queries saves a
      // round trip on the one screen a new host sees first.
      if (roomIds.length === 0) {
        return { rooms, bookings: [], blocks: [] };
      }

      // Sequential for the same reason as in availability.ts: one transaction is
      // one connection, so these cannot overlap, and `pg` warns when asked to
      // try.
      const bookings = await tx.booking.findMany({
        where: {
          roomId: { in: roomIds },
          status: { not: "CANCELLED" },
          // Half-open overlap: anything touching [from, to).
          checkIn: { lt: to },
          checkOut: { gt: from },
        },
        select: {
          id: true,
          roomId: true,
          guestName: true,
          checkIn: true,
          checkOut: true,
          source: true,
          createdByMembershipId: true,
        },
        orderBy: { checkIn: "asc" },
      });

      const blocks = await tx.block.findMany({
        where: {
          roomId: { in: roomIds },
          dateFrom: { lt: to },
          dateTo: { gt: from },
        },
        select: {
          id: true,
          roomId: true,
          reason: true,
          dateFrom: true,
          dateTo: true,
        },
        orderBy: { dateFrom: "asc" },
      });

      return { rooms, bookings, blocks };
    },
  );

  /** Turns an absolute date pair into a column offset and width. */
  const place = (start: Date, end: Date) => {
    const rawOffset = daysBetween(from, start);
    const rawEnd = daysBetween(from, end);
    const offset = Math.max(0, rawOffset);
    return {
      offset,
      span: Math.min(dayCount, rawEnd) - offset,
      openStart: rawOffset < 0,
      openEnd: rawEnd > dayCount,
      nights: daysBetween(start, end),
    };
  };

  const byRoom = new Map<string, Span[]>();
  const push = (roomId: string, span: Span) => {
    const list = byRoom.get(roomId);
    if (list) list.push(span);
    else byRoom.set(roomId, [span]);
  };

  for (const b of bookings) {
    push(b.roomId, {
      id: b.id,
      kind: "booking",
      label: b.guestName,
      source: b.source,
      createdByMembershipId: b.createdByMembershipId,
      ...place(b.checkIn, b.checkOut),
    });
  }

  for (const b of blocks) {
    push(b.roomId, {
      id: b.id,
      kind: "block",
      label: BLOCK_LABELS[b.reason] ?? "Đã khóa",
      source: null,
      createdByMembershipId: null,
      ...place(b.dateFrom, b.dateTo),
    });
  }

  const boardRooms: BoardRoom[] = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    propertyName: room.property.name,
    spans: (byRoom.get(room.id) ?? []).sort((a, b) => a.offset - b.offset),
  }));

  // Only bookings count toward occupancy. A night blocked for maintenance is
  // not a night sold, and counting it would flatter the number on exactly the
  // days a host most needs it to be honest.
  const soldNights = boardRooms.reduce(
    (total, room) =>
      total +
      room.spans
        .filter((s) => s.kind === "booking")
        .reduce((sum, s) => sum + s.span, 0),
    0,
  );
  const availableNights = boardRooms.length * dayCount;

  // Counted from the placed spans rather than re-queried: a booking bar covers
  // columns [offset, offset + span), which is the same half-open range the
  // database used to select it.
  const perDay = Array.from({ length: dayCount }, (_, column) => {
    const sold = boardRooms.filter((room) =>
      room.spans.some(
        (s) =>
          s.kind === "booking" &&
          s.offset <= column &&
          column < s.offset + s.span,
      ),
    ).length;
    return { sold, total: boardRooms.length };
  });

  return {
    from,
    to,
    days: Array.from({ length: dayCount }, (_, i) => addDays(from, i)),
    rooms: boardRooms,
    occupancy:
      availableNights === 0
        ? 0
        : Math.round((soldNights / availableNights) * 100),
    perDay,
  };
}

const BLOCK_LABELS: Record<string, string> = {
  MAINTENANCE: "Bảo trì",
  OWNER_STAY: "Chủ nhà ở",
  CHANNEL_SYNC: "Đã bán trên kênh khác",
  OTHER: "Đã khóa",
};

export const SOURCE_LABELS: Record<string, string> = {
  DIRECT: "Trực tiếp",
  AIRBNB: "Airbnb",
  BOOKING_COM: "Booking.com",
  AGODA: "Agoda",
  TRAVELOKA: "Traveloka",
  OTHER: "Kênh khác",
};
