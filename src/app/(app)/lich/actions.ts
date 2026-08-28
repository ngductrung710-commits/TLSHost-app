"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { NightsTakenError, assertNightsFree } from "@/lib/availability";
import { canManageBookings, requireMember } from "@/lib/dal";
import { PG_EXCLUSION_VIOLATION, pgErrorCode, withOrg } from "@/lib/db";
import { parseIsoDate, shortVi, toIsoDate } from "@/lib/dates";

export type BookingState = { error: string | null };

const createSchema = z.object({
  roomId: z.string().min(1),
  guestName: z.string().trim().min(1, "Nhập tên khách."),
  guestEmail: z.string().trim().toLowerCase().email().or(z.literal("")),
  guestPhone: z.string().trim(),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.coerce.number().int().min(1).max(50),
  totalCents: z.coerce.number().int().min(0).optional(),
  source: z.enum(["DIRECT", "AIRBNB", "BOOKING_COM", "AGODA", "TRAVELOKA", "OTHER"]),
  notes: z.string().trim(),
});

/**
 * Turns a set of conflicts into one sentence a host can act on.
 *
 * "Đã có người giữ" alone leaves them to go hunting for who. Naming the guest
 * and the dates means the next click is the right one.
 */
function conflictMessage(conflicts: { label: string; from: Date; to: Date }[]): string {
  const parts = conflicts
    .slice(0, 3)
    .map((c) => `${c.label} (${shortVi(c.from)}–${shortVi(c.to)})`);
  const more = conflicts.length > 3 ? ` và ${conflicts.length - 3} mục nữa` : "";
  return `Những đêm này đã có người giữ: ${parts.join(", ")}${more}.`;
}

export async function createBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const member = await requireMember();

  // Checked again here, not only in the page that renders the form. A server
  // action is a public endpoint: anyone who can reach the app can post to it,
  // whether or not they were ever shown the form.
  if (!canManageBookings(member)) {
    return { error: "Bạn không có quyền tạo đặt phòng." };
  }

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const data = parsed.data;

  const checkIn = parseIsoDate(data.checkIn);
  const checkOut = parseIsoDate(data.checkOut);
  if (!checkIn || !checkOut) return { error: "Ngày chưa hợp lệ." };
  if (checkOut <= checkIn) {
    return { error: "Ngày trả phòng phải sau ngày nhận phòng." };
  }

  try {
    await withOrg(member.orgId, async (tx) => {
      // The room must belong to this org. Row-level security already makes a
      // room from another org invisible, so a miss here means "not yours" and
      // "does not exist" are the same answer — which is the answer to give.
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
    if (error instanceof NightsTakenError) {
      return { error: conflictMessage(error.conflicts) };
    }

    // The exclusion constraint firing means another request took these nights
    // between our check and our insert. That is the guard working, not a bug —
    // and the reason the check above is not the only line of defence.
    if (pgErrorCode(error) === PG_EXCLUSION_VIOLATION) {
      return {
        error: "Vừa có người đặt những đêm này. Tải lại lịch và thử lại.",
      };
    }

    if (error instanceof Error && error.message === "ROOM_NOT_FOUND") {
      return { error: "Không tìm thấy phòng này." };
    }

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

  await withOrg(member.orgId, async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { createdByMembershipId: true },
    });
    if (!booking) return;

    // Owners may cancel anything; a collaborator only their own, unless the
    // owner has granted otherwise.
    const mayEdit =
      member.role === "OWNER" ||
      booking.createdByMembershipId === member.membershipId ||
      member.canEditOthersBookings;
    if (!mayEdit) return;

    // Cancelled, never deleted. The nights are freed by the constraint's WHERE
    // clause while the row survives as a record of what happened.
    await tx.booking.update({ where: { id }, data: { status: "CANCELLED" } });
  });

  revalidatePath("/lich");
}
