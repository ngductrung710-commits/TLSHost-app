"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { NightsTakenError, assertNightsFree } from "@/lib/availability";
import { mailBookingInBackground } from "@/lib/bookingMail";
import {
  PG_EXCLUSION_VIOLATION,
  pgErrorCode,
  withOrg,
  withPublicSlug,
} from "@/lib/db";
import { daysBetween, parseIsoDate, shortVi } from "@/lib/dates";
import { guestT } from "@/lib/guestLocale";
import { fill } from "@/lib/i18n";
import { origin } from "@/lib/origin";
import { notifyOrgInBackground } from "@/lib/push";

export type GuestState = { error: string | null };

const schema = z.object({
  slug: z.string().min(1),
  roomId: z.string().min(1),
  checkIn: z.string(),
  checkOut: z.string(),
  guestName: z.string().trim().min(1, "Nhập tên của bạn."),
  guestEmail: z.string().trim().toLowerCase().email("Email chưa đúng định dạng."),
  guestPhone: z.string().trim().min(6, "Nhập số điện thoại để chủ nhà liên hệ."),
  guests: z.coerce.number().int().min(1).max(50),
  notes: z.string().trim().max(1000),
  /** Honeypot. A real guest never sees this field, so a filled one is a bot. */
  company: z.string().max(0).optional().or(z.literal("")),
});

const MAX_NIGHTS = 90;

const TAKEN =
  "Rất tiếc, những đêm này vừa có người đặt. Thử chọn ngày khác giúp mình nhé.";

/**
 * Which language to answer in.
 *
 * Read straight off the form rather than from the request, because a
 * server action has no URL to read. The widget posts it as a hidden field;
 * anything else is Vietnamese, which is also what a forged value gets.
 */
function localeOf(formData: FormData): "vi" | "en" {
  return formData.get("ng") === "en" ? "en" : "vi";
}

/**
 * Carry the language across a redirect, or a guest lands in the other one.
 *
 * Written for Vietnamese too, not only English. Omitting it leaves the
 * destination to Accept-Language, which sends a Vietnamese-reading guest on
 * an English phone to an English confirmation page for the booking they just
 * made in Vietnamese.
 */
function suffix(locale: "vi" | "en", first: boolean): string {
  return `${first ? "?" : "&"}ng=${locale}`;
}

export async function requestBooking(
  _prev: GuestState,
  formData: FormData,
): Promise<GuestState> {
  const locale = localeOf(formData);
  const t = guestT(locale);

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    // Every message in the schema above is a whole Vietnamese sentence,
    // which is exactly what this codebase uses as a translation key — so
    // the validator needs no second lookup table.
    const message = parsed.error.issues[0]?.message;
    return { error: message ? t(message) : t("Thông tin chưa hợp lệ.") };
  }

  const data = parsed.data;

  // Silently accepted and dropped: telling a bot it was caught only teaches it
  // which field to leave alone next time.
  // The route written whole, then the query — a path assembled out of
  // fragments is a path no reader and no link check can recognise.
  const done = `/dat/${data.slug}/xong`;
  if (data.company) redirect(`${done}${suffix(locale, true)}`);

  const checkIn = parseIsoDate(data.checkIn);
  const checkOut = parseIsoDate(data.checkOut);
  if (!checkIn || !checkOut) return { error: t("Ngày chưa hợp lệ.") };
  if (checkOut <= checkIn) {
    return { error: t("Ngày trả phòng phải sau ngày nhận phòng.") };
  }
  if (daysBetween(checkIn, checkOut) > MAX_NIGHTS) {
    return { error: fill(t("Đặt tối đa {n} đêm một lần."), { n: MAX_NIGHTS }) };
  }

  // Everything the form claimed about which property and room this is gets
  // re-derived from the slug. A posted roomId belonging to someone else's
  // property must not become a booking in their calendar.
  const found = await withPublicSlug(data.slug, async (tx) => {
    const property = await tx.property.findFirst({
      where: { publicSlug: data.slug, published: true },
      // name, address and currency are here for the confirmation letter: a
      // guest reading it later needs to know which place they booked, and the
      // total has to be printed in the currency it settles in.
      select: {
        id: true,
        orgId: true,
        name: true,
        address: true,
        currency: true,
      },
    });
    if (!property) return null;

    const room = await tx.room.findFirst({
      where: { id: data.roomId, propertyId: property.id },
      select: { id: true, name: true, capacity: true, basePrice: true },
    });
    if (!room) return null;

    return { orgId: property.orgId, property, room };
  });

  if (!found) return { error: t("Không tìm thấy phòng này.") };

  if (data.guests > found.room.capacity) {
    return {
      error: fill(t("Phòng này nhận tối đa {n} khách."), {
        n: found.room.capacity,
      }),
    };
  }

  let bookingId: string;
  let totalCents: number | null = null;
  let payable = false;

  try {
    const result = await withOrg(found.orgId, async (tx) => {
      // The same check the host's own calendar runs, including the room lock.
      // A guest and a host racing for the last night is exactly what it is for.
      await assertNightsFree(tx, {
        roomId: found.room.id,
        from: checkIn,
        to: checkOut,
      });

      const created = await tx.booking.create({
        data: {
          orgId: found.orgId,
          roomId: found.room.id,
          guestName: data.guestName,
          guestEmail: data.guestEmail,
          guestPhone: data.guestPhone,
          checkIn,
          checkOut,
          guests: data.guests,
          totalCents:
            found.room.basePrice === null
              ? null
              : found.room.basePrice * daysBetween(checkIn, checkOut),
          source: "DIRECT",
          notes: data.notes || null,
          // Null: nobody on the team entered this. That is what the
          // who-created-it trail should say, rather than naming someone who was
          // not involved.
          createdByMembershipId: null,
        },
        select: { id: true, totalCents: true },
      });

      // Read inside the same scope: whether to offer online payment depends on
      // the host having connected a provider, and on this booking having a
      // price at all. A room with no basePrice produces a null total, and
      // sending a guest to a checkout for nothing would be worse than sending
      // them nowhere.
      const account = await tx.paymentAccount.findFirst({
        where: { verifiedAt: { not: null } },
        select: { id: true },
      });

      return {
        id: created.id,
        totalCents: created.totalCents,
        payable: Boolean(account) && (created.totalCents ?? 0) > 0,
      };
    });

    bookingId = result.id;
    totalCents = result.totalCents;
    payable = result.payable;
  } catch (error) {
    // Both branches say the same thing to a guest. The distinction — our check
    // caught it, or the constraint did — matters to us, not to them.
    if (error instanceof NightsTakenError) return { error: t(TAKEN) };
    if (pgErrorCode(error) === PG_EXCLUSION_VIOLATION) return { error: t(TAKEN) };
    throw error;
  }

  // After the write, and not awaited. A guest pressing "book" must not wait on
  // a push service, and must not see an error because one was slow — the
  // booking already exists by the time this runs.
  // Read before the background work starts, not inside it: headers() belongs
  // to this request, and the letters are posted after the reply has gone.
  const base = await origin();

  mailBookingInBackground({
    orgId: found.orgId,
    propertyId: found.property.id,
    base,
    bookingId,
    guestLocale: locale,
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    guestPhone: data.guestPhone,
    propertyName: found.property.name,
    propertyAddress: found.property.address,
    roomName: found.room.name,
    checkIn,
    checkOut,
    guests: data.guests,
    totalCents,
    currency: found.property.currency,
    notes: data.notes || null,
  });

  notifyOrgInBackground(found.orgId, {
    title: "Đặt phòng mới",
    body: `${data.guestName} · ${shortVi(checkIn)}–${shortVi(checkOut)}`,
    url: "/lich",
  });

  // Paying is optional and the booking already exists, so the two endings
  // differ only in what the guest is offered next — never in whether the room
  // is theirs.
  redirect(
    payable
      ? `/dat/${data.slug}/thanh-toan?dat=${bookingId}${suffix(locale, false)}`
      : `${done}${suffix(locale, true)}`,
  );
}
