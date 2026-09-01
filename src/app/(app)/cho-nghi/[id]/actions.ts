"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { getT } from "@/lib/locale";

export type PublicPageState = { error: string | null; notice?: string };

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

const priceSchema = z.object({
  roomId: z.string().min(1),
  basePrice: z.string(),
});

export async function setRoomPrice(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (member.role !== "OWNER") return;

  const parsed = priceSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const raw = parsed.data.basePrice.trim();
  // An empty box means "no price", which is different from a price of zero —
  // one hides the figure, the other advertises a free room.
  const value = raw === "" ? null : Number(raw);
  if (value !== null && (!Number.isFinite(value) || value < 0)) return;

  await withOrg(member.orgId, (tx) =>
    tx.room.updateMany({
      where: { id: parsed.data.roomId },
      data: { basePrice: value === null ? null : Math.round(value) },
    }),
  );

  revalidatePath("/cho-nghi");
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
