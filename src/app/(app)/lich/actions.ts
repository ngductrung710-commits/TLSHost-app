"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { NightsTakenError, assertNightsFree } from "@/lib/availability";
import { canEditBooking, canManageBookings, requireMember } from "@/lib/dal";
import {
  PG_CHECK_VIOLATION,
  PG_EXCLUSION_VIOLATION,
  pgErrorCode,
  withOrg,
} from "@/lib/db";
import { parseIsoDate, shortVi, toIsoDate } from "@/lib/dates";
import { getT } from "@/lib/locale";
import { fill } from "@/lib/i18n";

export type BookingState = { error: string | null };

const bookingFields = {
  roomId: z.string().min(1),
  guestName: z.string().trim().min(1, "Nhập tên khách."),
  guestEmail: z.string().trim().toLowerCase().email().or(z.literal("")),
  guestPhone: z.string().trim(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.coerce.number().int().min(1).max(50),
  totalCents: z.coerce.number().int().min(0).optional(),
  source: z.enum([
    "DIRECT",
    "AIRBNB",
    "BOOKING_COM",
    "AGODA",
    "TRAVELOKA",
    "OTHER",
  ]),
  notes: z.string().trim(),
};

const createSchema = z.object(bookingFields);
const updateSchema = z.object({ ...bookingFields, id: z.string().min(1) });

/**
 * Turns a set of conflicts into one sentence a host can act on.
 *
 * "Đã có người giữ" alone leaves them to go hunting for who. Naming the guest
 * and the dates means the next click is the right one.
 */
async function conflictMessage(
  conflicts: { label: string; from: Date; to: Date }[],
): Promise<string> {
  const t = await getT();
  const parts = conflicts
    .slice(0, 3)
    .map((c) => `${c.label} (${shortVi(c.from)}–${shortVi(c.to)})`);
  const more =
    conflicts.length > 3
      ? fill(t(" và {n} mục nữa"), { n: conflicts.length - 3 })
      : "";
  return fill(t("Những đêm này đã có người giữ: {ai}{them}."), {
    ai: parts.join(", "),
    them: more,
  });
}

/** The two failures every calendar write shares, in one place. */
async function calendarError(error: unknown): Promise<BookingState | null> {
  if (error instanceof NightsTakenError) {
    return { error: await conflictMessage(error.conflicts) };
  }

  const sqlstate = pgErrorCode(error);

  // The exclusion constraint firing means another request took these nights
  // between our check and our insert. That is the guard working, not a bug —
  // and the reason the check before it is not the only line of defence.
  if (sqlstate === PG_EXCLUSION_VIOLATION) {
    return {
      error: "Vừa có người đặt những đêm này. Tải lại lịch và thử lại.",
    };
  }

  // Backwards or zero-night ranges are rejected in this file before any write,
  // so reaching the database's own check means a path got added that forgot to.
  // Cheap to catch, and the alternative is a 500 on a mistake we can name.
  if (sqlstate === PG_CHECK_VIOLATION) {
    return {
      error: "Khoảng ngày không hợp lệ — ngày kết thúc phải sau ngày bắt đầu.",
    };
  }

  if (error instanceof Error) {
    if (error.message === "ROOM_NOT_FOUND") {
      return { error: "Không tìm thấy phòng này." };
    }
    if (error.message === "BOOKING_NOT_FOUND") {
      return { error: "Không tìm thấy đặt phòng này." };
    }
    if (error.message === "FORBIDDEN") {
      return { error: "Đặt phòng này do người khác tạo, bạn không sửa được." };
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Bookings                                                                    */
/* -------------------------------------------------------------------------- */

export async function createBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const t = await getT();
  const member = await requireMember();

  // Checked again here, not only in the page that renders the form. A server
  // action is a public endpoint: anyone who can reach the app can post to it,
  // whether or not they were ever shown the form.
  if (!canManageBookings(member)) {
    return { error: t("Bạn không có quyền tạo đặt phòng.") };
  }

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? t("Thông tin chưa hợp lệ."),
    };
  }

  const data = parsed.data;

  const checkIn = parseIsoDate(data.checkIn);
  const checkOut = parseIsoDate(data.checkOut);
  if (!checkIn || !checkOut) return { error: t("Ngày chưa hợp lệ.") };
  if (checkOut <= checkIn) {
    return { error: t("Ngày trả phòng phải sau ngày nhận phòng.") };
  }

  try {
    await withOrg(member.orgId, async (tx) => {
      // Row-level security already makes a room from another org invisible, so
      // a miss here means "not yours" and "does not exist" give the same
      // answer — which is the answer to give.
      const room = await tx.room.findUnique({
        where: { id: data.roomId },
        select: { id: true },
      });
      if (!room) throw new Error("ROOM_NOT_FOUND");

      // Cross-table check: bookings and blocks cannot collide, and no single
      // constraint spans both tables. Takes a row lock on the room first.
      await assertNightsFree(tx, {
        roomId: data.roomId,
        from: checkIn,
        to: checkOut,
      });

      await tx.booking.create({
        data: {
          orgId: member.orgId,
          roomId: data.roomId,
          guestName: data.guestName,
          guestEmail: data.guestEmail || null,
          guestPhone: data.guestPhone || null,
          checkIn,
          checkOut,
          guests: data.guests,
          totalCents: data.totalCents ?? null,
          source: data.source,
          notes: data.notes || null,
          createdByMembershipId: member.membershipId,
        },
      });
    });
  } catch (error) {
    const known = await calendarError(error);
    if (known) return known;
    throw error;
  }

  revalidatePath("/lich");
  redirect(`/lich?tu=${toIsoDate(checkIn)}`);
}

export async function updateBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const t = await getT();
  const member = await requireMember();
  if (!canManageBookings(member)) {
    return { error: t("Bạn không có quyền sửa đặt phòng.") };
  }

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? t("Thông tin chưa hợp lệ."),
    };
  }

  const data = parsed.data;

  const checkIn = parseIsoDate(data.checkIn);
  const checkOut = parseIsoDate(data.checkOut);
  if (!checkIn || !checkOut) return { error: t("Ngày chưa hợp lệ.") };
  if (checkOut <= checkIn) {
    return { error: t("Ngày trả phòng phải sau ngày nhận phòng.") };
  }

  try {
    await withOrg(member.orgId, async (tx) => {
      const existing = await tx.booking.findUnique({
        where: { id: data.id },
        select: { id: true, createdByMembershipId: true, status: true },
      });
      if (!existing) throw new Error("BOOKING_NOT_FOUND");
      if (!canEditBooking(member, existing.createdByMembershipId)) {
        throw new Error("FORBIDDEN");
      }

      const room = await tx.room.findUnique({
        where: { id: data.roomId },
        select: { id: true },
      });
      if (!room) throw new Error("ROOM_NOT_FOUND");

      // A cancelled booking holds no nights, so moving one back into the
      // calendar has to be checked like a new booking. Either way the row
      // being edited is excluded, or it would be found colliding with itself.
      await assertNightsFree(tx, {
        roomId: data.roomId,
        from: checkIn,
        to: checkOut,
        ignoreBookingId: data.id,
      });

      await tx.booking.update({
        where: { id: data.id },
        data: {
          roomId: data.roomId,
          guestName: data.guestName,
          guestEmail: data.guestEmail || null,
          guestPhone: data.guestPhone || null,
          checkIn,
          checkOut,
          guests: data.guests,
          totalCents: data.totalCents ?? null,
          source: data.source,
          notes: data.notes || null,
        },
      });
    });
  } catch (error) {
    const known = await calendarError(error);
    if (known) return known;
    throw error;
  }

  revalidatePath("/lich");
  redirect(`/lich?tu=${toIsoDate(checkIn)}`);
}

export async function cancelBooking(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!canManageBookings(member)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  let backTo: string | null = null;

  await withOrg(member.orgId, async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { createdByMembershipId: true, checkIn: true },
    });
    if (!booking) return;
    if (!canEditBooking(member, booking.createdByMembershipId)) return;

    // Cancelled, never deleted. The nights are freed by the exclusion
    // constraint's WHERE clause while the row survives as a record of what
    // happened — which is the difference between a calendar and a whiteboard.
    await tx.booking.update({ where: { id }, data: { status: "CANCELLED" } });
    backTo = toIsoDate(booking.checkIn);
  });

  revalidatePath("/lich");
  redirect(backTo ? `/lich?tu=${backTo}` : "/lich");
}

/* -------------------------------------------------------------------------- */
/* Blocks                                                                      */
/* -------------------------------------------------------------------------- */

export type BlockState = { error: string | null };

const blockSchema = z.object({
  roomId: z.string().min(1),
  dateFrom: z.string(),
  dateTo: z.string(),
  reason: z.enum(["MAINTENANCE", "OWNER_STAY", "CHANNEL_SYNC", "OTHER"]),
  note: z.string().trim(),
});

export async function createBlock(
  _prev: BlockState,
  formData: FormData,
): Promise<BlockState> {
  const t = await getT();
  const member = await requireMember();
  if (!canManageBookings(member)) {
    return { error: t("Bạn không có quyền khóa phòng.") };
  }

  const parsed = blockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? t("Thông tin chưa hợp lệ."),
    };
  }

  const data = parsed.data;

  const dateFrom = parseIsoDate(data.dateFrom);
  const dateTo = parseIsoDate(data.dateTo);
  if (!dateFrom || !dateTo) return { error: t("Ngày chưa hợp lệ.") };
  if (dateTo <= dateFrom) {
    return { error: t("Ngày kết thúc phải sau ngày bắt đầu.") };
  }

  try {
    await withOrg(member.orgId, async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: data.roomId },
        select: { id: true },
      });
      if (!room) throw new Error("ROOM_NOT_FOUND");

      await assertNightsFree(tx, {
        roomId: data.roomId,
        from: dateFrom,
        to: dateTo,
      });

      await tx.block.create({
        data: {
          orgId: member.orgId,
          roomId: data.roomId,
          dateFrom,
          dateTo,
          reason: data.reason,
          note: data.note || null,
        },
      });
    });
  } catch (error) {
    const known = await calendarError(error);
    if (known) return known;
    throw error;
  }

  revalidatePath("/lich");
  redirect(`/lich?tu=${toIsoDate(dateFrom)}`);
}

export async function deleteBlock(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!canManageBookings(member)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Blocks are deleted rather than cancelled. Unlike a booking there is no
  // guest and no money, so there is nothing about a removed block worth
  // keeping a record of.
  await withOrg(member.orgId, (tx) => tx.block.deleteMany({ where: { id } }));

  revalidatePath("/lich");
  redirect("/lich");
}
