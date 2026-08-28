import "server-only";

import { visiblePropertyFilter, type ActiveMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { addDays } from "@/lib/dates";

/**
 * Today's housekeeping, worked out rather than stored.
 *
 * Two facts are kept on the room — what a person last said about it, and when
 * it was last cleaned. Everything below is derived from those plus the day's
 * bookings, which means there is no nightly job to run and nothing to be stale.
 * A room whose guest checked out this morning is dirty because the arithmetic
 * says so, not because something remembered to say so.
 */

export type RoomJob = {
  roomId: string;
  roomName: string;
  propertyName: string;

  /** What today asks of this room. */
  context: "TURNOVER" | "CHECKOUT" | "ARRIVAL" | "STAYOVER" | "EMPTY";
  /** True when a guest has left since it was last cleaned. */
  needsCleaning: boolean;
  state: "CLEAN" | "DIRTY" | "INSPECTED" | "MAINTENANCE";

  /** Who is arriving today, if anyone. Housekeepers do not see this. */
  arrivingGuest: string | null;
  cleanedAt: Date | null;
  cleanedBy: string | null;
};

const CONTEXT_LABELS: Record<RoomJob["context"], string> = {
  TURNOVER: "Chuyển khách",
  CHECKOUT: "Trả phòng",
  ARRIVAL: "Khách đến",
  STAYOVER: "Khách ở tiếp",
  EMPTY: "Trống",
};

export function contextLabel(context: RoomJob["context"]): string {
  return CONTEXT_LABELS[context];
}

export async function loadHousekeeping(
  member: ActiveMember,
  today: Date,
): Promise<RoomJob[]> {
  const tomorrow = addDays(today, 1);

  return withOrg(member.orgId, async (tx) => {
    const rooms = await tx.room.findMany({
      where: { property: visiblePropertyFilter(member) },
      select: {
        id: true,
        name: true,
        cleanState: true,
        cleanedAt: true,
        property: { select: { name: true } },
        cleanedByMembership: {
          select: { user: { select: { name: true } } },
        },
      },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });

    if (rooms.length === 0) return [];

    const roomIds = rooms.map((r) => r.id);

    // Everything touching today, plus the most recent departure, in one pass.
    // The window reaches back because "has anyone left since it was cleaned"
    // needs the last check-out, not only today's.
    const bookings = await tx.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { not: "CANCELLED" },
        checkOut: { gt: addDays(today, -90) },
        checkIn: { lt: tomorrow },
      },
      select: { roomId: true, guestName: true, checkIn: true, checkOut: true },
      orderBy: { checkOut: "desc" },
    });

    const byRoom = new Map<string, typeof bookings>();
    for (const b of bookings) {
      const list = byRoom.get(b.roomId);
      if (list) list.push(b);
      else byRoom.set(b.roomId, [b]);
    }

    return rooms.map((room): RoomJob => {
      const mine = byRoom.get(room.id) ?? [];

      const leavingToday = mine.some(
        (b) => b.checkOut.getTime() === today.getTime(),
      );
      const arriving = mine.find(
        (b) => b.checkIn.getTime() === today.getTime(),
      );
      const staying = mine.some(
        (b) => b.checkIn < today && b.checkOut > today,
      );

      const context: RoomJob["context"] =
        leavingToday && arriving
          ? "TURNOVER"
          : leavingToday
            ? "CHECKOUT"
            : arriving
              ? "ARRIVAL"
              : staying
                ? "STAYOVER"
                : "EMPTY";

      // The most recent departure that has already happened. `mine` is ordered
      // by checkOut descending, so the first one on or before today is it.
      const lastDeparture = mine.find((b) => b.checkOut <= tomorrow)?.checkOut;

      // A guest has left since the room was last cleaned. `cleanedAt` is an
      // instant and `checkOut` a calendar date at UTC midnight, so a room
      // cleaned at any point on the departure day counts as cleaned after it.
      const guestLeftSinceClean =
        lastDeparture !== undefined &&
        (room.cleanedAt === null || room.cleanedAt < lastDeparture);

      return {
        roomId: room.id,
        roomName: room.name,
        propertyName: room.property.name,
        context,
        needsCleaning:
          room.cleanState === "DIRTY" ||
          (room.cleanState !== "MAINTENANCE" && guestLeftSinceClean),
        state: room.cleanState,
        arrivingGuest: arriving?.guestName ?? null,
        cleanedAt: room.cleanedAt,
        cleanedBy: room.cleanedByMembership?.user.name ?? null,
      };
    });
  });
}
