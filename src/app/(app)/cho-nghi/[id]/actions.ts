"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isCountryCode } from "@/lib/countries";
import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { getT } from "@/lib/locale";
import { composeAddress, lines, parseAmenityIds } from "@/lib/propertyForm";
import { PROPERTY_TYPES } from "@/lib/propertyTypes";

export type PublicPageState = { error: string | null; notice?: string };

/* -------------------------------------------------------------------------- */
/* Phòng                                                                       */
/* -------------------------------------------------------------------------- */

export type RoomState = { error: string | null; notice?: string };

/**
 * Một phòng là một thứ đặt được, không phải một loại phòng.
 *
 * Bản thiết kế được đưa có khái niệm "loại phòng" với số lượng bên trong: một
 * Standard Room, năm phòng. Ứng dụng này cố ý không có bảng loại phòng —
 * ghi chú trong cho-nghi/actions.ts nói rõ vì sao: Room chính là thứ đặt
 * được, và đó là điều cho phép ràng buộc chống trùng lịch chỉ có đúng một
 * hình dạng. Thêm một tầng loại phòng lên trên sẽ phải dạy lại ràng buộc đó,
 * dạy lại lịch, dạy lại buồng phòng và dạy lại đồng bộ kênh.
 *
 * Nên form này thêm N phòng cùng lúc, đánh số như wizard vẫn làm. Nhìn giống
 * "thêm một loại phòng, số lượng 5", chỉ khác là bên dưới không có tầng nào
 * cả.
 */
const roomBase = {
  name: z.string().trim().min(1, "Đặt tên cho phòng."),
  description: z.string().trim().transform(lines),
  maxAdults: z.coerce.number().int().min(1).max(30),
  maxChildren: z.coerce.number().int().min(0).max(30),
  basePrice: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .transform((v) => (v === "" ? null : v)),
  minNights: z.coerce.number().int().min(1).max(365),
  // Ô trống nghĩa là không giới hạn, khác hẳn với một con số lớn.
  maxNights: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(365)])
    .transform((v) => (v === "" ? null : v)),
};

const createRoomSchema = z.object({
  ...roomBase,
  propertyId: z.string().min(1),
  count: z.coerce.number().int().min(1).max(50),
});

const updateRoomSchema = z.object({ ...roomBase, roomId: z.string().min(1) });

function nightRangeProblem(min: number, max: number | null): string | null {
  return max !== null && max < min
    ? "Số đêm nhiều nhất phải lớn hơn hoặc bằng số đêm ít nhất."
    : null;
}

export async function createRoom(
  _prev: RoomState,
  formData: FormData,
): Promise<RoomState> {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") return { error: t("Chỉ chủ nhà mới thêm được phòng.") };

  const parsed = createRoomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: t(parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.") };
  }
  const d = parsed.data;

  const bad = nightRangeProblem(d.minNights, d.maxNights);
  if (bad) return { error: t(bad) };

  const amenities = parseAmenityIds(formData.get("roomAmenities"));

  const made = await withOrg(member.orgId, async (tx) => {
    // Cơ sở tra ở đây chứ không tin propertyId gửi lên: RLS đã ràng theo tổ
    // chức, nhưng một id của cơ sở khác trong cùng tổ chức thì RLS không chặn.
    const property = await tx.property.findFirst({
      where: { id: d.propertyId },
      select: { id: true },
    });
    if (!property) return 0;

    const rows = Array.from({ length: d.count }, (_, i) => ({
      orgId: member.orgId,
      propertyId: property.id,
      name: d.count === 1 ? d.name : `${d.name} ${i + 1}`,
      capacity: d.maxAdults + d.maxChildren,
      maxAdults: d.maxAdults,
      maxChildren: d.maxChildren,
      description: d.description || null,
      basePrice: d.basePrice,
      minNights: d.minNights,
      maxNights: d.maxNights,
      amenities,
    }));

    await tx.room.createMany({ data: rows });
    return rows.length;
  });

  if (made === 0) return { error: t("Không tìm thấy cơ sở này.") };

  revalidatePath(`/cho-nghi/${d.propertyId}`);
  revalidatePath("/lich");
  return { error: null, notice: t("Đã thêm phòng.") };
}

export async function updateRoom(
  _prev: RoomState,
  formData: FormData,
): Promise<RoomState> {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") return { error: t("Chỉ chủ nhà mới sửa được phòng.") };

  const parsed = updateRoomSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: t(parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.") };
  }
  const d = parsed.data;

  const bad = nightRangeProblem(d.minNights, d.maxNights);
  if (bad) return { error: t(bad) };

  const changed = await withOrg(member.orgId, (tx) =>
    tx.room.updateMany({
      where: { id: d.roomId },
      data: {
        name: d.name,
        capacity: d.maxAdults + d.maxChildren,
        maxAdults: d.maxAdults,
        maxChildren: d.maxChildren,
        description: d.description || null,
        basePrice: d.basePrice,
        minNights: d.minNights,
        maxNights: d.maxNights,
        amenities: parseAmenityIds(formData.get("roomAmenities")),
      },
    }),
  );

  if (changed.count === 0) return { error: t("Không tìm thấy phòng này.") };

  revalidatePath("/cho-nghi");
  revalidatePath("/lich");
  revalidatePath("/dat", "layout");
  return { error: null, notice: t("Đã lưu.") };
}

/**
 * Xoá một phòng.
 *
 * Cùng một chốt như xoá cơ sở, và cùng lý do: phải gõ đúng tên. Xoá phòng kéo
 * theo mọi lượt đặt của nó, kể cả những lượt đã ở xong — mà một lượt đặt đã
 * qua vẫn là bản ghi của một đêm ai đó đã trả tiền.
 *
 * Số lượt đặt đếm ngay tại đây, không phải con số trang đã vẽ sẵn: một con số
 * do trang cũ đưa xuống là con số của lúc trang đó được dựng.
 */
export async function deleteRoom(
  _prev: RoomState,
  formData: FormData,
): Promise<RoomState> {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") return { error: t("Chỉ chủ nhà mới xóa được phòng.") };

  const roomId = String(formData.get("roomId") ?? "");
  const typed = String(formData.get("confirmName") ?? "").trim();
  if (!roomId) return { error: t("Không tìm thấy phòng này.") };

  const outcome = await withOrg(member.orgId, async (tx) => {
    const room = await tx.room.findFirst({
      where: { id: roomId },
      select: { id: true, name: true, propertyId: true },
    });
    if (!room) return "missing" as const;
    if (typed !== room.name) return "name" as const;

    await tx.room.delete({ where: { id: room.id } });
    return room.propertyId;
  });

  if (outcome === "missing") return { error: t("Không tìm thấy phòng này.") };
  if (outcome === "name") return { error: t("Tên chưa khớp.") };

  revalidatePath(`/cho-nghi/${outcome}`);
  revalidatePath("/lich");
  revalidatePath("/buong-phong");
  return { error: null, notice: t("Đã xóa phòng.") };
}

/* -------------------------------------------------------------------------- */
/* Sửa thông tin cơ sở                                                         */
/* -------------------------------------------------------------------------- */

export type EditState = { error: string | null; notice?: string };

/** "HH:MM" hoặc null. Xem ghi chú ở checkInFrom bên dưới. */
const clock = z
  .string()
  .trim()
  .transform((v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null));

/**
 * Một quy định ba trạng thái, giới hạn theo đúng những lựa chọn mà ô này bày
 * ra. Cột trong cơ sở dữ liệu nhận cả ba giá trị của enum, nhưng "hút thuốc —
 * cần duyệt" không phải một câu có nghĩa, nên nó bị chặn ở đây chứ không chờ
 * ai đó đọc ra sau này.
 */
function allowance(allowed: readonly ("ALLOWED" | "ON_REQUEST" | "NOT_ALLOWED")[]) {
  return z
    .string()
    .trim()
    .transform((v) =>
      (allowed as readonly string[]).includes(v)
        ? (v as "ALLOWED" | "ON_REQUEST" | "NOT_ALLOWED")
        : null,
    );
}

/**
 * Cùng bộ trường như lúc tạo, trừ phòng.
 *
 * Trước commit này, tạo xong là hết: trang chi tiết bày tên, địa chỉ, tiện
 * nghi và nội quy ra dưới dạng chỉ đọc, và chính chú thích trong đó thừa nhận
 * "changing an amenity after creation needs an editor this page does not have
 * yet". Nghĩa là gõ sai tên đường thì cách sửa duy nhất là xoá cả cơ sở —
 * kéo theo mọi phòng và mọi đơn đặt của nó.
 *
 * Tiền tệ không nằm ở đây. Nó quyết định mọi con số đã lưu của cơ sở, và đổi
 * nó sau khi đã có đơn đặt sẽ diễn giải lại giá cũ theo đơn vị mới mà không
 * đụng vào con số — 800.000 ₫ thành 800.000 $. Đó là việc riêng, cần cảnh báo
 * riêng, không phải một ô trong form sửa tên.
 */
const editSchema = z.object({
  propertyId: z.string().min(1),
  name: z.string().trim().min(1, "Đặt tên cho cơ sở."),
  type: z.enum(PROPERTY_TYPES).nullable().catch(null),

  addressLine1: z.string().trim().min(1, "Điền số nhà và tên đường."),
  addressLine2: z.string().trim(),
  city: z.string().trim().min(1, "Điền thành phố."),
  region: z.string().trim(),
  postalCode: z.string().trim(),
  countryCode: z.string().transform((c) => (isCountryCode(c) ? c : "VN")),

  intro: z.string().trim().max(600).transform(lines),
  houseRules: z.string().trim().transform(lines),

  /**
   * Giờ trên đồng hồ treo tường, dạng "HH:MM".
   *
   * Ô trống về null, và null nghĩa là chưa đặt. Chuỗi lạ cũng về null thay vì
   * làm hỏng cả thao tác lưu: giá trị này đến từ <input type="time"> do chính
   * ứng dụng vẽ ra, nên một chuỗi sai nghĩa là có gì đó hỏng ở phía chúng ta,
   * và chặn chủ nhà lại là cách sai để phát hiện điều đó.
   */
  checkInFrom: clock,
  checkOutBy: clock,
  quietHoursFrom: clock,
  quietHoursTo: clock,

  smokingPolicy: allowance(["ALLOWED", "NOT_ALLOWED"]),
  petsPolicy: allowance(["ALLOWED", "NOT_ALLOWED"]),
  eventsPolicy: allowance(["ON_REQUEST", "NOT_ALLOWED"]),
  photographyPolicy: allowance(["ON_REQUEST", "NOT_ALLOWED"]),
  childrenPolicy: z
    .enum(["", "SUITABLE", "NOT_SUITABLE"])
    .catch("")
    .transform((v) => (v === "" ? null : v)),

  depositNote: z.string().trim().max(400),
});

export async function updateProperty(
  _prev: EditState,
  formData: FormData,
): Promise<EditState> {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") {
    return { error: t("Chỉ chủ nhà mới sửa được cơ sở.") };
  }

  const parsed = editSchema.safeParse({
    propertyId: formData.get("propertyId"),
    name: formData.get("name"),
    type: formData.get("type") || null,
    addressLine1: formData.get("addressLine1") ?? "",
    addressLine2: formData.get("addressLine2") ?? "",
    city: formData.get("city") ?? "",
    region: formData.get("region") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    countryCode: formData.get("countryCode") ?? "VN",
    intro: formData.get("intro") ?? "",
    houseRules: formData.get("houseRules") ?? "",
    checkInFrom: formData.get("checkInFrom") ?? "",
    checkOutBy: formData.get("checkOutBy") ?? "",
    quietHoursFrom: formData.get("quietHoursFrom") ?? "",
    quietHoursTo: formData.get("quietHoursTo") ?? "",
    smokingPolicy: formData.get("smokingPolicy") ?? "",
    petsPolicy: formData.get("petsPolicy") ?? "",
    eventsPolicy: formData.get("eventsPolicy") ?? "",
    photographyPolicy: formData.get("photographyPolicy") ?? "",
    childrenPolicy: formData.get("childrenPolicy") ?? "",
    depositNote: formData.get("depositNote") ?? "",
  });
  if (!parsed.success) {
    return { error: t(parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.") };
  }
  const data = parsed.data;

  // updateMany chứ không update: nó nhận mệnh đề where và trả về số dòng đã
  // đổi, nên một id thuộc tổ chức khác sửa trúng 0 dòng thay vì ném lỗi lộ ra
  // rằng id đó có tồn tại. RLS đã chặn sẵn, đây là lớp thứ hai.
  const changed = await withOrg(member.orgId, (tx) =>
    tx.property.updateMany({
      where: { id: data.propertyId },
      data: {
        name: data.name,
        type: data.type,
        address: composeAddress(data) || null,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        region: data.region || null,
        postalCode: data.postalCode || null,
        countryCode: data.countryCode,
        intro: data.intro || null,
        houseRules: data.houseRules || null,
        amenities: parseAmenityIds(formData.get("propertyAmenities")),
        checkInFrom: data.checkInFrom,
        checkOutBy: data.checkOutBy,
        smokingPolicy: data.smokingPolicy,
        petsPolicy: data.petsPolicy,
        eventsPolicy: data.eventsPolicy,
        photographyPolicy: data.photographyPolicy,
        childrenPolicy: data.childrenPolicy,
        // Giờ yên tĩnh chỉ được lưu khi có ĐỦ hai đầu. Một đầu thiếu không
        // phải một khoảng, và lưu nó lại sẽ hiện lên trang khách thành một
        // câu cụt: "yên tĩnh từ 22:00 đến —".
        quietHoursFrom: data.quietHoursTo === null ? null : data.quietHoursFrom,
        quietHoursTo: data.quietHoursFrom === null ? null : data.quietHoursTo,
        depositNote: data.depositNote || null,
      },
    }),
  );

  if (changed.count === 0) return { error: t("Không tìm thấy cơ sở này.") };

  // Cả trang khách đặt phòng nữa: tên, giới thiệu và nội quy đều hiện ở đó,
  // và một thay đổi chỉ thấy trong không gian quản lý là một thay đổi chủ nhà
  // tưởng đã đăng mà khách chưa hề thấy.
  revalidatePath("/cho-nghi");
  revalidatePath(`/cho-nghi/${data.propertyId}`);
  revalidatePath("/dat", "layout");

  return { error: null, notice: t("Đã lưu.") };
}

const publishSchema = z.object({
  propertyId: z.string().min(1),
  slug: z.string().trim(),
  intro: z.string().trim().max(600),
  published: z.coerce.boolean(),
});

export async function publishProperty(
  _prev: PublicPageState,
  formData: FormData,
): Promise<PublicPageState> {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") {
    return { error: t("Chỉ chủ nhà mới đổi được trang này.") };
  }

  const parsed = publishSchema.safeParse({
    propertyId: formData.get("propertyId"),
    slug: formData.get("slug"),
    intro: formData.get("intro"),
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("Thông tin chưa hợp lệ.") };
  }

  const { propertyId, intro, published } = parsed.data;
  const slug = slugify(parsed.data.slug);

  if (published && slug.length < 3) {
    return { error: t("Đường dẫn cần ít nhất 3 ký tự.") };
  }

  try {
    await withOrg(member.orgId, async (tx) => {
      const property = await tx.property.findUnique({
        where: { id: propertyId },
        select: { id: true },
      });
      if (!property) throw new Error("NOT_FOUND");

      await tx.property.update({
        where: { id: property.id },
        data: {
          publicSlug: slug || null,
          intro: intro || null,
          published,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { error: t("Không tìm thấy chỗ nghỉ này.") };
    }
    // publicSlug is unique across every organization, because the URL is
    // global. Another host may already have taken this word.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { error: t("Đường dẫn này đã có người dùng. Thử thêm tên địa danh.") };
    }
    throw error;
  }

  revalidatePath(`/cho-nghi/${propertyId}`);
  return {
    error: null,
    notice: published
      ? t("Trang đã mở. Chia sẻ link bên dưới cho khách.")
      : t("Đã đóng trang. Link giữ nguyên, mở lại lúc nào cũng được."),
  };
}

/* -------------------------------------------------------------------------- */
/* Deleting a property                                                         */
/* -------------------------------------------------------------------------- */

export type DeleteState = { error: string | null };

/**
 * Delete a property, its rooms, and everything hanging off them.
 *
 * There is no undo and no archive. That is a deliberate choice rather than a
 * missing feature: an archived property still has rooms, and rooms are what
 * the calendar, the housekeeping board and the overlap constraint are built
 * on — every one of those queries would need to learn to filter, and the one
 * that forgot would show a guest a room that no longer takes bookings.
 *
 * So the guard is at the door instead of in the data. Three of them:
 *
 *   1. Owner only, like adding one.
 *   2. The name has to be typed. Not a checkbox — a checkbox is a thing you
 *      tick on the way to the button, and this is the one action in the
 *      product that destroys a revenue record.
 *   3. The count of what goes is read here, at the moment of deleting, and
 *      shown before it. A number rendered by the page it sits on is a number
 *      from whenever that page was built.
 *
 * Bookings go with it. That is real loss — a cancelled booking is still the
 * record of a night someone paid for — so the confirmation says how many, and
 * says separately how many have not checked out yet, which is the number that
 * means a guest is arriving to a property that has stopped existing.
 */
export async function deleteProperty(
  _prev: DeleteState,
  formData: FormData,
): Promise<DeleteState> {
  const t = await getT();
  const member = await requireMember();

  // Same rule as creating one: a collaborator works inside the properties they
  // were given, and deleting one would take away rooms other people are
  // scoped to.
  if (member.role !== "OWNER") {
    return { error: t("Chỉ chủ nhà mới xóa được cơ sở.") };
  }

  const propertyId = String(formData.get("propertyId") ?? "");
  const typed = String(formData.get("confirmName") ?? "").trim();
  if (propertyId === "") return { error: t("Thông tin chưa hợp lệ.") };

  const outcome = await withOrg(member.orgId, async (tx) => {
    const property = await tx.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true },
    });
    // withOrg scopes the read, so a property from another organization is not
    // "forbidden" here — it is simply not there, and says so.
    if (!property) return "NOT_FOUND" as const;

    // Checked against the name in the database, not against a name the form
    // carried with it. A hidden field holding the expected answer is a
    // confirmation that confirms itself.
    if (typed !== property.name) return "NAME_MISMATCH" as const;

    await tx.property.delete({ where: { id: property.id } });
    return "DELETED" as const;
  });

  if (outcome === "NOT_FOUND") return { error: t("Không tìm thấy cơ sở này.") };
  if (outcome === "NAME_MISMATCH") {
    return { error: t("Tên chưa khớp. Gõ đúng tên cơ sở để xác nhận.") };
  }

  revalidatePath("/cho-nghi");
  revalidatePath("/lich");
  revalidatePath("/buong-phong");
  revalidatePath("/tong-quan");
  redirect("/cho-nghi");
}
