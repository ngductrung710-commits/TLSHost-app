"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { NightsTakenError, assertNightsFree } from "@/lib/availability";
import {
  PG_EXCLUSION_VIOLATION,
  pgErrorCode,
  withOrg,
  withPublicSlug,
} from "@/lib/db";
import { daysBetween, parseIsoDate, shortVi } from "@/lib/dates";
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

export async function requestBooking(
  _prev: GuestState,
  formData: FormData,
): Promise<GuestState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const data = parsed.data;

  // Silently accepted and dropped: telling a bot it was caught only teaches it
  // which field to leave alone next time.
  if (data.company) redirect(`/dat/${data.slug}/xong`);

  const checkIn = parseIsoDate(data.checkIn);
  const checkOut = parseIsoDate(data.checkOut);
  if (!checkIn || !checkOut) return { error: "Ngày chưa hợp lệ." };
  if (checkOut <= checkIn) {
    return { error: "Ngày trả phòng phải sau ngày nhận phòng." };
  }
  if (daysBetween(checkIn, checkOut) > MAX_NIGHTS) {
    return { error: `Đặt tối đa ${MAX_NIGHTS} đêm một lần.` };
  }

  // Everything the form claimed about which property and room this is gets
  // re-derived from the slug. A posted roomId belonging to someone else's
  // property must not become a booking in their calendar.
  const found = await withPublicSlug(data.slug, async (tx) => {
    const property = await tx.property.findFirst({
      where: { publicSlug: data.slug, published: true },
      select: { id: true, orgId: true },
    });
    if (!property) return null;

    const room = await tx.room.findFirst({
      where: { id: data.roomId, propertyId: property.id },
      select: { id: true, capacity: true, basePrice: true },
    });
    if (!room) return null;

    return { orgId: property.orgId, room };
  });

  if (!found) return { error: "Không tìm thấy phòng này." };

  if (data.guests > found.room.capacity) {
    return { error: `Phòng này nhận tối đa ${found.room.capacity} khách.` };
  }

  let bookingId: string;
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
        payable: Boolean(account) && (created.totalCents ?? 0) > 0,
      };
    });

    bookingId = result.id;
    payable = result.payable;
  } catch (error) {
    // Both branches say the same thing to a guest. The distinction — our check
    // caught it, or the constraint did — matters to us, not to them.
    if (error instanceof NightsTakenError) return { error: TAKEN };
    if (pgErrorCode(error) === PG_EXCLUSION_VIOLATION) return { error: TAKEN };
    throw error;
  }

  // After the write, and not awaited. A guest pressing "book" must not wait on
  // a push service, and must not see an error because one was slow — the
  // booking already exists by the time this runs.
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
      ? `/dat/${data.slug}/thanh-toan?dat=${bookingId}`
      : `/dat/${data.slug}/xong`,
  );
}
