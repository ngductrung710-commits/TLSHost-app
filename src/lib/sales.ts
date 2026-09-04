import "server-only";

import { type ActiveMember, visiblePropertyFilter } from "@/lib/member";
import { withOrg } from "@/lib/db";
import { daysBetween } from "@/lib/dates";

/**
 * "A guest wants these nights — can we take it, and for how much?"
 *
 * The calendar answers a different question. It shows a month across every
 * room, which is the right shape for looking at the business and the wrong
 * shape for someone on the phone with a guest: they know the dates and the
 * headcount, and they need the answer before the caller loses patience.
 *
 * So this asks the question the other way round. Dates and guests in, rooms
 * out, priced for the whole stay.
 *
 * It is not a hold. Two people can be told the same room is free at the same
 * moment, and the exclusion constraint decides which booking survives — the
 * one guarantee that has to live in the database rather than in a screen.
 */

export type Vacancy = {
  roomId: string;
  roomName: string;
  propertyId: string;
  propertyName: string;
  capacity: number;
  basePrice: number | null;
  /** For the whole stay. Null when the room has no rate set. */
  total: number | null;
};

export type Availability = {
  nights: number;
  /** Rooms big enough for the party, whether or not they are free. */
  considered: number;
  vacancies: Vacancy[];
  /**
   * Rooms that would fit the party but are taken.
   *
   * Counted rather than listed: knowing "4 of 11 free" is the difference
   * between quoting confidently and quoting a rate that is about to be the
   * only room left.
   */
  taken: number;
};

export async function findVacancies(
  member: ActiveMember,
  { from, to, guests }: { from: Date; to: Date; guests: number },
): Promise<Availability> {
  const nights = daysBetween(from, to);

  return withOrg(member.orgId, async (tx) => {
    const rooms = await tx.room.findMany({
      where: {
        property: visiblePropertyFilter(member),
        capacity: { gte: guests },
      },
      select: {
        id: true,
        name: true,
        capacity: true,
        basePrice: true,
        property: { select: { id: true, name: true } },
      },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });

    if (rooms.length === 0) {
      return { nights, considered: 0, vacancies: [], taken: 0 };
    }

    const ids = rooms.map((r) => r.id);

    // Half-open, the same as the exclusion constraint: a stay ending on the
    // 5th and one starting on the 5th do not overlap, because the first guest
    // is gone by the time the second arrives. Getting this wrong in the
    // direction of caution would refuse perfectly sellable nights.
    const overlap = { checkIn: { lt: to }, checkOut: { gt: from } };

    // Sequential, not Promise.all — see the same note in src/lib/availability.ts.
    // One transaction is one connection, so pg serialises these anyway and
    // warns that the parallel form is deprecated and breaks in pg@9.
    const bookings = await tx.booking.findMany({
      where: { roomId: { in: ids }, status: { not: "CANCELLED" }, ...overlap },
      select: { roomId: true },
    });
    const blocks = await tx.block.findMany({
      where: {
        roomId: { in: ids },
        dateFrom: { lt: to },
        dateTo: { gt: from },
      },
      select: { roomId: true },
    });

    const busy = new Set([
      ...bookings.map((b) => b.roomId),
      ...blocks.map((b) => b.roomId),
    ]);

    const vacancies = rooms
      .filter((room) => !busy.has(room.id))
      .map((room) => ({
        roomId: room.id,
        roomName: room.name,
        propertyId: room.property.id,
        propertyName: room.property.name,
        capacity: room.capacity,
        basePrice: room.basePrice,
        total: room.basePrice === null ? null : room.basePrice * nights,
      }));

    return {
      nights,
      considered: rooms.length,
      vacancies,
      taken: rooms.length - vacancies.length,
    };
  });
}
