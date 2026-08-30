import "server-only";

import { withOrg } from "@/lib/db";
import { type ActiveMember, visiblePropertyFilter } from "@/lib/member";

/**
 * "A guest is on the phone and I need their booking."
 *
 * The calendar is the wrong tool for that: it is laid out by room and date,
 * and the one thing the caller can tell you is their name. Scrolling three
 * months looking for it is what this replaces.
 *
 * Cancelled bookings are included on purpose. "I cancelled last week and want
 * to rebook" is a real call, and a search that hides the record makes it look
 * like the guest is misremembering.
 */

export type Hit = {
  id: string;
  guestName: string;
  guestPhone: string | null;
  roomName: string;
  propertyName: string;
  checkIn: Date;
  checkOut: Date;
  status: string;
  source: string;
};

const MAX_HITS = 25;

export async function findBookings(
  member: ActiveMember,
  query: string,
): Promise<Hit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  return withOrg(member.orgId, async (tx) => {
    const rows = await tx.booking.findMany({
      where: {
        room: { property: visiblePropertyFilter(member) },
        OR: [
          { guestName: { contains: q, mode: "insensitive" } },
          { guestPhone: { contains: q } },
          { guestEmail: { contains: q, mode: "insensitive" } },
          // The booking id is what someone reads back off a confirmation, and
          // they will read the tail of it rather than all twenty-five
          // characters.
          { id: { endsWith: q } },
        ],
      },
      select: {
        id: true,
        guestName: true,
        guestPhone: true,
        checkIn: true,
        checkOut: true,
        status: true,
        source: true,
        room: { select: { name: true, property: { select: { name: true } } } },
      },
      // Soonest arrival first among upcoming stays is what someone on a call
      // actually wants; ordering by name would bury it.
      orderBy: { checkIn: "desc" },
      take: MAX_HITS,
    });

    return rows.map((row) => ({
      id: row.id,
      guestName: row.guestName,
      guestPhone: row.guestPhone,
      roomName: row.room.name,
      propertyName: row.room.property.name,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      status: row.status,
      source: row.source,
    }));
  });
}
