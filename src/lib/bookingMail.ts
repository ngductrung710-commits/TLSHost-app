import "server-only";

import { after } from "next/server";

import { formatMoney, fullDate } from "@/lib/dates";
import { withOrg } from "@/lib/db";
import { shownPrice } from "@/lib/exchange";
import { fill, makeT, type Locale } from "@/lib/i18n";
import { dictFor } from "@/lib/locale";
import { sendMail } from "@/lib/mail";

/**
 * The two letters a new booking has to produce.
 *
 * A guest who fills in a form and sees a confirmation screen has nothing
 * afterwards: no dates, no address, nothing to show at the door, and no way to
 * tell whether the booking survived closing the tab. And a host who is not
 * sitting in the workspace learns about the booking whenever they next open
 * it — the push notification only reaches a browser that granted permission on
 * a device that is switched on.
 *
 * Both are sent after the booking row exists and neither is awaited by the
 * request. A slow mail provider must never turn a booking that was made into
 * an error page that says it was not.
 */

/** Who on the team should hear about a booking. */
//
// Housekeepers are left out: the schema says they never touch bookings, and an
// email nobody can act on is the kind that teaches people to ignore the rest.
// A collaborator limited to certain properties only hears about those — being
// scoped out of a property means not being told who is arriving at it.
const NOTIFIED_ROLES = ["OWNER", "COLLABORATOR"] as const;

type Recipient = { email: string; locale: Locale };

async function recipients(orgId: string, propertyId: string): Promise<Recipient[]> {
  return withOrg(orgId, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { locale: true },
    });
    const locale: Locale = org?.locale === "en" ? "en" : "vi";

    const members = await tx.membership.findMany({
      where: { role: { in: [...NOTIFIED_ROLES] }, joinedAt: { not: null } },
      select: { id: true, user: { select: { email: true } } },
    });

    // The scopes are read in a second query rather than selected alongside
    // `user` above. A to-many next to a to-one in one Prisma select is what
    // makes the pg driver warn about multiple statements in a transaction —
    // src/lib/dal.ts carries the same split for the same reason.
    const scopes = await tx.membershipScope.findMany({
      where: { membershipId: { in: members.map((m) => m.id) } },
      select: { membershipId: true, propertyId: true },
    });

    const limited = new Map<string, string[]>();
    for (const s of scopes) {
      limited.set(s.membershipId, [...(limited.get(s.membershipId) ?? []), s.propertyId]);
    }

    return members
      // No rows in MembershipScope means every property, which is what an
      // owner always has and what an unscoped collaborator has too.
      .filter((m) => (limited.get(m.id) ?? [propertyId]).includes(propertyId))
      .map((m) => ({ email: m.user.email, locale }));
  });
}

export type BookingMailInput = {
  orgId: string;
  propertyId: string;
  base: string;
  bookingId: string;
  /** The language the guest was reading the booking page in. */
  guestLocale: Locale;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  propertyName: string;
  propertyAddress: string | null;
  roomName: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  /** Minor units in the org's settlement currency, or null for a room with no price. */
  totalCents: number | null;
  currency: string;
  notes: string | null;
};

function guestLetter(b: BookingMailInput) {
  const t = makeT(dictFor(b.guestLocale));
  const shown =
    b.totalCents === null ? null : shownPrice(b.totalCents, b.currency, b.guestLocale);

  const lines = [
    fill(t("Chào {ten},"), { ten: b.guestName }),
    "",
    t("Chúng tôi đã nhận đặt phòng của bạn. Dưới đây là những gì đã ghi lại."),
    "",
    `${t("Chỗ ở")}: ${b.propertyName}`,
    `${t("Phòng")}: ${b.roomName}`,
    `${t("Nhận phòng")}: ${fullDate(b.checkIn, b.guestLocale)}`,
    `${t("Trả phòng")}: ${fullDate(b.checkOut, b.guestLocale)}`,
    `${t("Số khách")}: ${b.guests}`,
  ];

  if (shown) {
    const money = formatMoney(shown.amount, shown.currency, b.guestLocale);
    // A converted figure is labelled as one. A guest who is charged in dong
    // and reads a dollar total must be able to see which of the two the host
    // will actually ask for.
    lines.push(
      `${t("Tổng")}: ${
        shown.converted
          ? fill(t("{gia} (quy đổi từ {goc})"), {
              gia: money,
              goc: formatMoney(b.totalCents ?? 0, b.currency, b.guestLocale),
            })
          : money
      }`,
    );
  }

  if (b.propertyAddress) lines.push("", `${t("Địa chỉ")}: ${b.propertyAddress}`);

  lines.push(
    "",
    t("Chủ nhà sẽ liên hệ nếu cần thêm thông tin. Trả lời thư này nếu bạn muốn đổi gì đó."),
  );

  return {
    subject: fill(t("Đã nhận đặt phòng — {noi}"), { noi: b.propertyName }),
    text: lines.join("\n"),
  };
}

function hostLetter(b: BookingMailInput, locale: Locale) {
  const t = makeT(dictFor(locale));

  const lines = [
    `${b.propertyName} · ${b.roomName}`,
    `${fullDate(b.checkIn, locale)} – ${fullDate(b.checkOut, locale)}`,
    "",
    `${t("Khách")}: ${b.guestName}`,
    `${t("Số khách")}: ${b.guests}`,
    `${t("Điện thoại")}: ${b.guestPhone}`,
    `${t("Email")}: ${b.guestEmail}`,
  ];

  // The host is shown the amount that will settle, in the currency it settles
  // in, and never a converted one: this is the number that has to match the
  // bank.
  if (b.totalCents !== null) {
    lines.push(`${t("Tổng")}: ${formatMoney(b.totalCents, b.currency, locale)}`);
  }
  if (b.notes) lines.push("", `${t("Ghi chú")}: ${b.notes}`);

  lines.push("", `${b.base}/lich/dat-phong/${b.bookingId}`);

  return {
    subject: fill(t("Đặt phòng mới: {ten}"), { ten: b.guestName }),
    text: lines.join("\n"),
  };
}

async function mailBooking(b: BookingMailInput): Promise<void> {
  const guest = guestLetter(b);
  await sendMail({ to: b.guestEmail, subject: guest.subject, text: guest.text });

  for (const person of await recipients(b.orgId, b.propertyId)) {
    const host = hostLetter(b, person.locale);
    await sendMail({ to: person.email, subject: host.subject, text: host.text });
  }
}

/**
 * Posted after the reply, not during it.
 *
 * `after` rather than a bare floating promise — which is what the push
 * notification beside this uses. The difference is that after() keeps the
 * invocation alive until the task settles, and a dropped promise is a letter
 * that silently never went. A guest can live without a push notification;
 * a guest whose only record of the booking was that email cannot.
 *
 * The rejection is swallowed on purpose. The booking is already written by
 * the time this runs, sendMail has already logged whatever failed, and there
 * is no longer a request to tell.
 */
export function mailBookingInBackground(b: BookingMailInput): void {
  after(() => mailBooking(b).catch(() => {}));
}
