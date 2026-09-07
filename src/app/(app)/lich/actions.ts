"use server";


import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { NightsTakenError, assertNightsFree } from "@/lib/availability";
import {
  canEditBooking,
  canManageBookings,
  requireMember,
  visiblePropertyFilter,
} from "@/lib/dal";
import {
  PG_CHECK_VIOLATION,
  PG_EXCLUSION_VIOLATION,
  pgErrorCode,
  withOrg,
} from "@/lib/db";
import { AUTO_ROOM } from "@/lib/bookingForm";
import { parseIsoDate, shortVi, toIsoDate } from "@/lib/dates";
import { getT } from "@/lib/locale";
import { fill } from "@/lib/i18n";

/**
 * Đổi tên một phòng, ngay trên bảng lịch.
 *
 * Riêng một action thay vì dùng lại updateRoom bên cho-nghi: cái kia nhận cả
 * sức chứa, giá và số đêm, và một form chỉ có ô tên gửi lên sẽ ghi đè mọi
 * trường còn lại bằng giá trị mặc định của schema. Sửa tên trên lịch mà xoá
 * mất giá phòng là loại lỗi không ai nghi ngờ cho tới lúc khách hỏi.
 *
 * Chỉ chủ nhà. Cộng tác viên quản lý lượt đặt bên trong những cơ sở được giao,
 * còn tên phòng là hình dạng của chính cơ sở đó.
 */
export async function renameRoom(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (member.role !== "OWNER") return;

  const roomId = String(formData.get("roomId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  // Tên rỗng bị bỏ qua trong im lặng chứ không báo lỗi: ô này nằm ngay trong
  // bảng, không có chỗ nào đặt một dòng lỗi mà không đẩy cả lưới xuống. Không
  // lưu, và tên cũ hiện lại nguyên vẹn sau khi trang vẽ lại.
  if (!roomId || name === "" || name.length > 120) return;

  await withOrg(member.orgId, (tx) =>
    tx.room.updateMany({ where: { id: roomId }, data: { name } }),
  );

  revalidatePath("/lich");
  revalidatePath("/buong-phong");
  revalidatePath("/cho-nghi");
}

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
  // Ba ô của ngăn kéo. Trang /lich/moi vẫn chỉ gửi `guests`, nên cả ba đều
  // optional: một form cũ không được thành không hợp lệ chỉ vì có form mới.
  adults: z.coerce.number().int().min(0).max(50).optional(),
  children: z.coerce.number().int().min(0).max(50).optional(),
  infants: z.coerce.number().int().min(0).max(50).optional(),
  depositCents: z.coerce.number().int().min(0).optional(),
  // Checkbox: có mặt trong FormData nghĩa là đã tích, vắng mặt nghĩa là không.
  depositPaid: z.coerce.boolean().optional(),
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
    if (error.message === "NO_FREE_ROOM") {
      return { error: "Không còn phòng nào trống trong những đêm này." };
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

/**
 * Phần lõi dùng chung của hai lối tạo đơn: trang /lich/moi và ngăn kéo trên
 * lịch. Trả về ngày nhận phòng khi thành công, để bên gọi tự quyết định đi đâu
 * tiếp — trang thì chuyển hướng, ngăn kéo thì đóng lại và ở nguyên trên lịch.
 */
async function saveNewBooking(
  formData: FormData,
): Promise<BookingState | { checkIn: Date }> {
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

  // Phần tách chỉ đến từ ngăn kéo. Khi không có, tổng `guests` là tất cả những
  // gì form nói ra, và dồn hết vào người lớn — giống hệt cách migration đối xử
  // với dữ liệu cũ, để hai đường vào không sinh ra hai kiểu hàng khác nhau.
  const hasSplit = data.adults !== undefined;
  const adults = hasSplit ? data.adults! : data.guests;
  const children = data.children ?? 0;
  const infants = data.infants ?? 0;
  const guests = hasSplit ? adults + children : data.guests;
  if (guests < 1) return { error: t("Cần ít nhất một khách.") };

  try {
    const created = await withOrg(member.orgId, async (tx) => {
      let roomId = data.roomId;

      if (roomId === AUTO_ROOM) {
        // "Tự động gán": thử từng phòng nhìn thấy được, lấy phòng đầu tiên
        // còn trống. Thử chứ không truy vấn một câu tìm phòng trống, vì
        // assertNightsFree mới là thứ biết đủ — nó xét cả lượt đặt lẫn đêm bị
        // chặn, và nó khoá hàng lại, nên phòng nó trả về vẫn còn trống ở dòng
        // ngay sau.
        const candidates = await tx.room.findMany({
          where: { property: visiblePropertyFilter(member) },
          select: { id: true },
          orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
        });

        let picked: string | null = null;
        for (const candidate of candidates) {
          try {
            await assertNightsFree(tx, {
              roomId: candidate.id,
              from: checkIn,
              to: checkOut,
            });
            picked = candidate.id;
            break;
          } catch (error) {
            if (error instanceof NightsTakenError) continue;
            throw error;
          }
        }
        if (!picked) throw new Error("NO_FREE_ROOM");
        roomId = picked;
      } else {
        // Row-level security already makes a room from another org invisible,
        // so a miss here means "not yours" and "does not exist" give the same
        // answer — which is the answer to give.
        const room = await tx.room.findUnique({
          where: { id: roomId },
          select: { id: true },
        });
        if (!room) throw new Error("ROOM_NOT_FOUND");

        // Cross-table check: bookings and blocks cannot collide, and no single
        // constraint spans both tables. Takes a row lock on the room first.
        await assertNightsFree(tx, { roomId, from: checkIn, to: checkOut });
      }

      // Tiền cọc chỉ được đánh dấu đã nhận khi có một con số. Tích ô mà bỏ
      // trống số tiền thì không có gì để nói là đã nhận.
      const deposit = data.depositCents ?? null;

      // Ngăn kéo không gửi tổng tiền khi để hệ thống tự gán phòng: lúc bấm nút
      // nó chưa biết phòng nào, nên chưa biết giá nào. Tính ở đây, từ giá của
      // đúng cái phòng vừa được chọn.
      let totalCents = data.totalCents ?? null;
      if (totalCents === null) {
        const priced = await tx.room.findUnique({
          where: { id: roomId },
          select: { basePrice: true },
        });
        const nights = Math.round(
          (checkOut.getTime() - checkIn.getTime()) / 86_400_000,
        );
        totalCents =
          priced?.basePrice != null ? priced.basePrice * nights : null;
      }

      // Số đơn kế tiếp trong tổ chức: max hiện có + 1. Nằm trong cùng giao
      // dịch đã khoá phòng qua assertNightsFree, nên hai đơn tạo cùng lúc
      // không nhận trùng số — và unique(orgId, ref) là lưới an toàn cuối.
      const top = await tx.booking.aggregate({
        where: { orgId: member.orgId },
        _max: { ref: true },
      });
      const nextRef = (top._max.ref ?? 0) + 1;

      await tx.booking.create({
        data: {
          orgId: member.orgId,
          roomId,
          ref: nextRef,
          guestName: data.guestName,
          guestEmail: data.guestEmail || null,
          guestPhone: data.guestPhone || null,
          checkIn,
          checkOut,
          guests,
          adults,
          children,
          infants,
          totalCents,
          depositCents: deposit,
          depositPaidAt: data.depositPaid && deposit ? new Date() : null,
          // Đơn mới bắt đầu ở "chờ xử lý", đúng như bản thiết kế: chủ nhà bấm
          // "Xác nhận" khi đã chắc. Đơn từ kênh về là chuyện khác — chúng đã
          // được kênh xác nhận rồi — nhưng đó là đường tạo khác, không qua đây.
          status: "PENDING",
          source: data.source,
          notes: data.notes || null,
          createdByMembershipId: member.membershipId,
        },
      });

      return true;
    });

    if (!created) return { error: t("Thông tin chưa hợp lệ.") };
  } catch (error) {
    const known = await calendarError(error);
    if (known) return known;
    throw error;
  }

  return { checkIn };
}

export async function createBooking(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const result = await saveNewBooking(formData);
  if ("error" in result) return result;

  revalidatePath("/lich");
  redirect(`/lich?tu=${toIsoDate(result.checkIn)}`);
}

/**
 * Cùng việc, nhưng không chuyển hướng.
 *
 * Ngăn kéo nằm ngay trên bảng lịch: đơn vừa tạo phải hiện ra ở đúng chỗ vừa
 * bấm, chứ không phải sau một lần tải lại trang đưa mình về đầu danh sách.
 * revalidatePath là đủ — Next vẽ lại bảng, ngăn kéo tự đóng.
 */
export async function createBookingInline(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const result = await saveNewBooking(formData);
  if ("error" in result) return result;

  revalidatePath("/lich");
  return { error: null };
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

/**
 * Dời trạng thái một lượt đặt — xác nhận, nhận phòng, trả phòng, vắng mặt.
 *
 * Không kiểm chuyển tiếp hợp lệ theo kiểu máy trạng thái cứng nhắc: thẻ trên
 * lịch chỉ bày ra đúng những bước đi được từ trạng thái hiện tại, nên một yêu
 * cầu vô lý (đang chờ mà đòi trả phòng) không có đường bấm tới. Ở đây chỉ chặn
 * những giá trị không phải trạng thái, và để "Hủy" cho action riêng của nó vì
 * hủy còn giải phóng các đêm.
 */
export async function setBookingStatus(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const t = await getT();
  const member = await requireMember();
  if (!canManageBookings(member)) {
    return { error: t("Bạn không có quyền sửa đặt phòng.") };
  }

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW"];
  if (!id || !allowed.includes(status)) {
    return { error: t("Thông tin chưa hợp lệ.") };
  }

  await withOrg(member.orgId, async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { createdByMembershipId: true },
    });
    if (!booking) throw new Error("BOOKING_NOT_FOUND");
    if (!canEditBooking(member, booking.createdByMembershipId)) {
      throw new Error("FORBIDDEN");
    }
    await tx.booking.updateMany({
      where: { id },
      data: { status: status as never },
    });
  }).catch((error) => {
    // Nuốt hai lỗi đã biết thành câu người đọc được; ném tiếp thứ lạ.
    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") return;
    if (error instanceof Error && error.message === "FORBIDDEN") return;
    throw error;
  });

  revalidatePath("/lich");
  revalidatePath(`/lich/dat-phong/${id}`);
  return { error: null };
}

/**
 * Ghi nhận đã thu đủ tiền: cọc bằng tổng, và đánh dấu thời điểm.
 *
 * Đây là cách chủ nhà tự ghi lại "khách đã trả xong", khác với Payment do cổng
 * thanh toán sinh ra. Một cú bấm ghi trọn phần còn lại — trường hợp thường
 * nhất — và vẫn sửa lại được ở trang chi tiết nếu cần con số khác.
 */
export async function markBookingPaid(
  _prev: BookingState,
  formData: FormData,
): Promise<BookingState> {
  const t = await getT();
  const member = await requireMember();
  if (!canManageBookings(member)) {
    return { error: t("Bạn không có quyền sửa đặt phòng.") };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: t("Thông tin chưa hợp lệ.") };

  let problem: string | null = null;
  await withOrg(member.orgId, async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: { createdByMembershipId: true, totalCents: true },
    });
    if (!booking) throw new Error("BOOKING_NOT_FOUND");
    if (!canEditBooking(member, booking.createdByMembershipId)) {
      throw new Error("FORBIDDEN");
    }
    if (booking.totalCents === null) {
      problem = t("Đơn chưa có giá để ghi nhận thanh toán.");
      return;
    }
    await tx.booking.updateMany({
      where: { id },
      data: { depositCents: booking.totalCents, depositPaidAt: new Date() },
    });
  }).catch((error) => {
    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") return;
    if (error instanceof Error && error.message === "FORBIDDEN") return;
    throw error;
  });

  if (problem) return { error: problem };

  revalidatePath("/lich");
  revalidatePath(`/lich/dat-phong/${id}`);
  return { error: null };
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
