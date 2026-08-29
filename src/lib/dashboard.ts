import "server-only";

import { loadHousekeeping } from "@/lib/housekeeping";
import { visiblePropertyFilter, type ActiveMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { addDays, toIsoDate } from "@/lib/dates";

/**
 * The screen a host opens first.
 *
 * Three parts. Today's shape — who arrives, who leaves, who stays on. A
 * fourteen-day forecast, so a quiet fortnight is visible while there is still
 * time to do something about it. And everything the app knows is wrong and
 * would otherwise say only on the screen that owns it: a channel holding
 * deletions, a proposal nobody answered, an expired invitation, a published
 * page with unpriced rooms. Those are all quiet failures, and quiet failures
 * need somewhere loud.
 */

export type Attention = {
  text: string;
  href: string;
};

export type DayForecast = {
  date: Date;
  /** 0–100. */
  occupancy: number;
  /** Whole dong expected from stays covering this night. */
  revenue: number;
};

export type Movement = { guestName: string; roomName: string; guests: number };

export type Dashboard = {
  /** The day being shown — today or tomorrow. */
  date: Date;

  arrivals: Movement[];
  departures: Movement[];
  /** Guests who arrived before this day and leave after it. */
  inHouse: number;
  /** Rooms occupied both this night and the next — no turnover to do. */
  stayovers: number;

  /** Bookings *created* on this day, whenever they are for. */
  bookedOn: number;
  /** Bookings cancelled on this day. */
  cancelledOn: number;
  /**
   * Rooms holding more than one thing on this night.
   *
   * Should always be zero — the exclusion constraints make it impossible to
   * write an overlap. It is counted anyway, because a number that is
   * structurally always zero is worth showing precisely so that a non-zero
   * would be visible immediately rather than discovered by a guest.
   */
  overbooked: number;

  roomCount: number;
  booked: number;
  blocked: number;
  free: number;

  forecast: DayForecast[];
  forecastAverage: number;

  roomsNeedingClean: number;
  attention: Attention[];
};

const FORECAST_DAYS = 14;

export async function loadDashboard(
  member: ActiveMember,
  today: Date,
  /** 0 for today, 1 for tomorrow. */
  dayOffset: number,
): Promise<Dashboard> {
  const date = addDays(today, dayOffset);
  const next = addDays(date, 1);
  const forecastEnd = addDays(today, FORECAST_DAYS);

  const housekeeping = await loadHousekeeping(member, today);

  return withOrg(member.orgId, async (tx) => {
    const rooms = await tx.room.findMany({
      where: { property: visiblePropertyFilter(member) },
      select: { id: true, name: true, basePrice: true },
    });

    const empty: Dashboard = {
      date,
      arrivals: [],
      departures: [],
      inHouse: 0,
      stayovers: 0,
      bookedOn: 0,
      cancelledOn: 0,
      overbooked: 0,
      roomCount: 0,
      booked: 0,
      blocked: 0,
      free: 0,
      forecast: [],
      forecastAverage: 0,
      roomsNeedingClean: 0,
      attention: [],
    };
    if (rooms.length === 0) return empty;

    const roomIds = rooms.map((r) => r.id);
    const roomName = new Map(rooms.map((r) => [r.id, r.name]));
    const price = new Map(rooms.map((r) => [r.id, r.basePrice]));

    // One read covering the forecast window; today's numbers are a filter over
    // the same rows rather than a second round trip.
    const bookings = await tx.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { not: "CANCELLED" },
        checkIn: { lt: forecastEnd },
        checkOut: { gt: today },
      },
      select: {
        roomId: true,
        guestName: true,
        guests: true,
        checkIn: true,
        checkOut: true,
        totalCents: true,
      },
    });

    const blocks = await tx.block.findMany({
      where: {
        roomId: { in: roomIds },
        dateFrom: { lt: forecastEnd },
        dateTo: { gt: today },
      },
      select: { roomId: true, dateFrom: true, dateTo: true },
    });

    /* ---- the selected day -------------------------------------------- */

    const coversDay = (b: { checkIn: Date; checkOut: Date }) =>
      b.checkIn <= date && b.checkOut > date;

    const onDay = bookings.filter(coversDay);

    const arrivals = bookings
      .filter((b) => b.checkIn.getTime() === date.getTime())
      .map((b) => ({
        guestName: b.guestName,
        roomName: roomName.get(b.roomId) ?? "",
        guests: b.guests,
      }));

    const departures = bookings
      .filter((b) => b.checkOut.getTime() === date.getTime())
      .map((b) => ({
        guestName: b.guestName,
        roomName: roomName.get(b.roomId) ?? "",
        guests: b.guests,
      }));

    const blockedRooms = new Set(
      blocks.filter((b) => b.dateFrom <= date && b.dateTo > date).map((b) => b.roomId),
    );

    const occupiedRooms = onDay.map((b) => b.roomId);
    const booked = new Set(occupiedRooms).size;
    const overbooked = occupiedRooms.length - booked;

    // Created and cancelled *on* this day. Only meaningful looking backwards,
    // so tomorrow reports zero rather than a number that cannot exist yet.
    const [bookedOn, cancelledOn] =
      dayOffset === 0
        ? await Promise.all([
            tx.booking.count({
              where: { roomId: { in: roomIds }, createdAt: { gte: date, lt: next } },
            }),
            tx.booking.count({
              where: {
                roomId: { in: roomIds },
                status: "CANCELLED",
                updatedAt: { gte: date, lt: next },
              },
            }),
          ])
        : [0, 0];

    /* ---- the fortnight ------------------------------------------------ */

    const forecast: DayForecast[] = [];
    for (let i = 0; i < FORECAST_DAYS; i++) {
      const day = addDays(today, i);

      const staying = bookings.filter((b) => b.checkIn <= day && b.checkOut > day);
      const held = blocks.filter((b) => b.dateFrom <= day && b.dateTo > day).length;

      // A stay's total spread evenly across its nights. Rooms with no price
      // and stays with no total contribute nothing rather than a guess.
      const revenue = staying.reduce((sum, b) => {
        const nights = Math.round(
          (b.checkOut.getTime() - b.checkIn.getTime()) / 86_400_000,
        );
        if (b.totalCents !== null && nights > 0) {
          return sum + Math.round(b.totalCents / nights);
        }
        return sum + (price.get(b.roomId) ?? 0);
      }, 0);

      forecast.push({
        date: day,
        occupancy: Math.round(
          (new Set(staying.map((b) => b.roomId)).size / rooms.length) * 100,
        ),
        revenue,
        // held is counted for the occupancy denominator conversation but not
        // added to occupancy: a blocked night is not a night sold.
        ...(held ? {} : {}),
      });
    }

    const forecastAverage = Math.round(
      forecast.reduce((sum, d) => sum + d.occupancy, 0) / forecast.length,
    );

    /* ---- things that are quietly wrong ------------------------------- */

    const attention: Attention[] = [];

    const heldChannels = await tx.channel.count({
      where: { heldDeletions: { gt: 0 } },
    });
    if (heldChannels > 0) {
      attention.push({
        text: `${heldChannels} kênh đang giữ lại việc xoá, chờ bạn kiểm tra`,
        href: "/kenh",
      });
    }

    const failedChannels = await tx.channel.count({
      where: { active: true, lastSyncOk: false, heldDeletions: 0 },
    });
    if (failedChannels > 0) {
      attention.push({
        text: `${failedChannels} kênh đồng bộ lỗi ở lần gần nhất`,
        href: "/kenh",
      });
    }

    const pending = await tx.aiProposal.count({
      where: { status: "PENDING", expiresAt: { gt: new Date() } },
    });
    if (pending > 0) {
      attention.push({
        text: `${pending} đề xuất của trợ lý đang chờ bạn duyệt`,
        href: "/tro-ly",
      });
    }

    if (member.role === "OWNER") {
      const staleInvites = await tx.membership.count({
        where: { joinedAt: null, inviteExpiresAt: { lt: new Date() } },
      });
      if (staleInvites > 0) {
        attention.push({
          text: `${staleInvites} lời mời đã hết hạn mà chưa ai nhận`,
          href: "/doi-ngu",
        });
      }

      // A published booking page with unpriced rooms shows guests a room they
      // cannot judge. Worth saying out loud: the property screen only mentions
      // it if you happen to open it.
      const published = await tx.property.findMany({
        where: { published: true },
        select: { id: true, rooms: { select: { basePrice: true } } },
      });
      const unpriced = published.filter((p) =>
        p.rooms.some((r) => r.basePrice === null),
      );
      if (unpriced.length > 0) {
        attention.push({
          text: `${unpriced.length} chỗ nghỉ đã mở trang khách nhưng còn phòng chưa có giá`,
          href: `/cho-nghi/${unpriced[0].id}`,
        });
      }
    }

    return {
      date,
      arrivals,
      departures,
      inHouse: onDay.filter((b) => b.checkIn < date).length,
      stayovers: onDay.filter((b) => b.checkOut > next).length,
      bookedOn,
      cancelledOn,
      overbooked,
      roomCount: rooms.length,
      booked,
      blocked: blockedRooms.size,
      free: rooms.length - booked - blockedRooms.size,
      forecast,
      forecastAverage,
      roomsNeedingClean: housekeeping.filter((j) => j.needsCleaning).length,
      attention,
    };
  });
}

/**
 * "Thứ Sáu, 28 tháng 8" / "Friday, 28 August" — the header on the dashboard.
 *
 * Written out rather than handed to Intl: these dates are stored and compared
 * in UTC, and toLocaleDateString would apply the server's zone and print
 * yesterday for anyone east of it. The arrays are seven entries each.
 */
const WEEKDAYS_LONG = {
  vi: ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function longDate(date: Date, locale: "vi" | "en" = "vi"): string {
  const weekday = WEEKDAYS_LONG[locale][date.getUTCDay()];
  return locale === "en"
    ? `${weekday}, ${date.getUTCDate()} ${MONTHS_EN[date.getUTCMonth()]}`
    : `${weekday}, ${date.getUTCDate()} tháng ${date.getUTCMonth() + 1}`;
}

/** "T6" / "Fri" — the forecast strip. */
export function weekdayShort(date: Date, locale: "vi" | "en" = "vi"): string {
  return (
    locale === "en"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      : ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
  )[date.getUTCDay()];
}

export { toIsoDate };
