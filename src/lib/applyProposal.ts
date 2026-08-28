import "server-only";

import { NightsTakenError, assertNightsFree } from "@/lib/availability";
import type { ActiveMember } from "@/lib/dal";
import {
  PG_CHECK_VIOLATION,
  PG_EXCLUSION_VIOLATION,
  pgErrorCode,
  withOrg,
} from "@/lib/db";
import { parseIsoDate, shortVi } from "@/lib/dates";
import { proposalSchema, type Proposal } from "@/lib/proposals";

/**
 * Applying an approved proposal.
 *
 * This is the only place a proposal turns into a change, and it deliberately
 * shares every guard with the paths a host clicks through: the same
 * assertNightsFree behind the same room lock, the same exclusion constraints,
 * the same row-level security. There is no fast path for the assistant, and
 * adding one later would remove the reason to trust it.
 *
 * The stored payload is re-parsed here rather than trusted. It was validated
 * when it was written, but a proposal sits in a table for up to half an hour,
 * and a row that changed shape in between should be refused rather than
 * applied.
 */

export type ApplyResult = { ok: true } | { ok: false; error: string };

function conflictMessage(
  conflicts: { label: string; from: Date; to: Date }[],
): string {
  const parts = conflicts
    .slice(0, 3)
    .map((c) => `${c.label} (${shortVi(c.from)}–${shortVi(c.to)})`);
  const more = conflicts.length > 3 ? ` và ${conflicts.length - 3} mục nữa` : "";
  return `Những đêm này đã có người giữ: ${parts.join(", ")}${more}.`;
}

export async function applyProposal({
  member,
  raw,
}: {
  member: ActiveMember;
  /** The `payload` column, straight from the row. */
  raw: unknown;
}): Promise<ApplyResult> {
  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Đề xuất này không còn đọc được. Hãy soạn lại." };
  }

  const proposal: Proposal = parsed.data;

  if (proposal.kind === "NONE") {
    return { ok: false, error: "Đề xuất này không có thay đổi nào để áp dụng." };
  }

  try {
    await withOrg(member.orgId, async (tx) => {
      switch (proposal.kind) {
        case "CREATE_BOOKING": {
          const checkIn = parseIsoDate(proposal.checkIn);
          const checkOut = parseIsoDate(proposal.checkOut);
          if (!checkIn || !checkOut || checkOut <= checkIn) {
            throw new Error("BAD_DATES");
          }

          // Row-level security already hides another org's room, so a miss
          // here covers both "not yours" and "the model invented an id".
          const room = await tx.room.findUnique({
            where: { id: proposal.roomId },
            select: { id: true },
          });
          if (!room) throw new Error("ROOM_NOT_FOUND");

          await assertNightsFree(tx, {
            roomId: proposal.roomId,
            from: checkIn,
            to: checkOut,
          });

          await tx.booking.create({
            data: {
              orgId: member.orgId,
              roomId: proposal.roomId,
              guestName: proposal.guestName,
              guestEmail: proposal.guestEmail || null,
              guestPhone: proposal.guestPhone || null,
              checkIn,
              checkOut,
              guests: proposal.guests,
              source: proposal.source,
              notes: proposal.notes || null,
              // The person who approved it, not the assistant. A booking has to
              // be attributable to someone who can be asked about it.
              createdByMembershipId: member.membershipId,
            },
          });
          return;
        }

        case "BLOCK_NIGHTS": {
          const from = parseIsoDate(proposal.dateFrom);
          const to = parseIsoDate(proposal.dateTo);
          if (!from || !to || to <= from) throw new Error("BAD_DATES");

          const room = await tx.room.findUnique({
            where: { id: proposal.roomId },
            select: { id: true },
          });
          if (!room) throw new Error("ROOM_NOT_FOUND");

          await assertNightsFree(tx, { roomId: proposal.roomId, from, to });

          await tx.block.create({
            data: {
              orgId: member.orgId,
              roomId: proposal.roomId,
              dateFrom: from,
              dateTo: to,
              reason: proposal.reason,
              note: proposal.note || null,
            },
          });
          return;
        }

        case "CANCEL_BOOKING": {
          const booking = await tx.booking.findUnique({
            where: { id: proposal.bookingId },
            select: { id: true, status: true },
          });
          if (!booking) throw new Error("BOOKING_NOT_FOUND");
          if (booking.status === "CANCELLED") throw new Error("ALREADY_CANCELLED");

          await tx.booking.update({
            where: { id: booking.id },
            data: { status: "CANCELLED" },
          });
          return;
        }

        case "MOVE_BOOKING": {
          const checkIn = parseIsoDate(proposal.checkIn);
          const checkOut = parseIsoDate(proposal.checkOut);
          if (!checkIn || !checkOut || checkOut <= checkIn) {
            throw new Error("BAD_DATES");
          }

          const booking = await tx.booking.findUnique({
            where: { id: proposal.bookingId },
            select: { id: true },
          });
          if (!booking) throw new Error("BOOKING_NOT_FOUND");

          const room = await tx.room.findUnique({
            where: { id: proposal.roomId },
            select: { id: true },
          });
          if (!room) throw new Error("ROOM_NOT_FOUND");

          // Excluding the row being moved, or it collides with itself.
          await assertNightsFree(tx, {
            roomId: proposal.roomId,
            from: checkIn,
            to: checkOut,
            ignoreBookingId: booking.id,
          });

          await tx.booking.update({
            where: { id: booking.id },
            data: { roomId: proposal.roomId, checkIn, checkOut },
          });
          return;
        }

        case "SET_PRICE": {
          const room = await tx.room.findUnique({
            where: { id: proposal.roomId },
            select: { id: true },
          });
          if (!room) throw new Error("ROOM_NOT_FOUND");

          await tx.room.update({
            where: { id: room.id },
            data: { basePrice: proposal.basePrice },
          });
          return;
        }
      }
    });
  } catch (error) {
    if (error instanceof NightsTakenError) {
      return { ok: false, error: conflictMessage(error.conflicts) };
    }

    const sqlstate = pgErrorCode(error);
    if (sqlstate === PG_EXCLUSION_VIOLATION) {
      return {
        ok: false,
        error: "Vừa có người giữ những đêm này. Soạn lại đề xuất.",
      };
    }
    if (sqlstate === PG_CHECK_VIOLATION) {
      return { ok: false, error: "Khoảng ngày trong đề xuất không hợp lệ." };
    }

    if (error instanceof Error) {
      const known: Record<string, string> = {
        BAD_DATES: "Ngày trong đề xuất không hợp lệ.",
        ROOM_NOT_FOUND: "Phòng trong đề xuất không còn tồn tại.",
        BOOKING_NOT_FOUND: "Đặt phòng trong đề xuất không còn tồn tại.",
        ALREADY_CANCELLED: "Đặt phòng này đã được hủy trước đó.",
      };
      const message = known[error.message];
      if (message) return { ok: false, error: message };
    }

    throw error;
  }

  return { ok: true };
}
