"use server";

import { revalidatePath } from "next/cache";
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
