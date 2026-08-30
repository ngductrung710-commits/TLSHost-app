"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { LIMIT_MESSAGES } from "@/lib/plans";
import { getT } from "@/lib/locale";
import { PROPERTY_TYPES } from "@/lib/propertyTypes";

export type PropertyState = { error: string | null };

/**
 * A room as the wizard collects it.
 *
 * Capacity and rate arrive with the room now. They used to need a second visit
 * to the property page after creating it — a visit most people never make, and
 * a room with no rate shows a guest no price.
 */
const roomSchema = z.object({
  name: z.string().trim().min(1),
  capacity: z.coerce.number().int().min(1).max(30),
  // Empty means "not priced yet", which is a real state: the room still takes
  // bookings, the guest just sees no figure.
  basePrice: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .transform((v) => (v === "" ? null : v)),
});

const schema = z.object({
  name: z.string().trim().min(1, "Đặt tên cho chỗ nghỉ."),
  type: z.enum(PROPERTY_TYPES).nullable().catch(null),
  address: z.string().trim(),
  intro: z.string().trim(),
  // One room per line. A villa rented whole is one property with one room —
  // keeping every bookable thing a Room means the overlap constraint has
  // exactly one shape to enforce.
  rooms: z.array(roomSchema).min(1, "Cần ít nhất một phòng."),
});

export async function createProperty(
  _prev: PropertyState,
  formData: FormData,
): Promise<PropertyState> {
  const t = await getT();
  const member = await requireMember();

  // Only an owner shapes the inventory. A collaborator manages bookings inside
  // the properties they were given; letting them add properties would put
  // rooms outside anyone's scope.
  if (member.role !== "OWNER") {
    return { error: t("Chỉ chủ nhà mới thêm được chỗ nghỉ.") };
  }

  // The wizard posts its rooms as JSON in one field: they are a list of
  // objects, and FormData has no shape for that short of rooms[0][name],
  // which is worse to parse than this is.
  let rooms: unknown = [];
  try {
    rooms = JSON.parse(String(formData.get("rooms") ?? "[]"));
  } catch {
    return { error: t("Thông tin chưa hợp lệ.") };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || null,
    address: formData.get("address") ?? "",
    intro: formData.get("intro") ?? "",
    rooms,
  });
  if (!parsed.success) {
    return { error: t(parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.") };
  }

  const roomNames = parsed.data.rooms.map((room) => room.name);
  if (roomNames.length !== new Set(roomNames).size) {
    return { error: t("Có tên phòng bị trùng. Mỗi phòng cần một tên riêng.") };
  }

  // Counted at the moment of creation, not cached on the org. A limit that
  // reads a stale counter is a limit that can be walked past by opening two
  // tabs.
  const max = member.limits.maxProperties;
  if (max !== null) {
    const existing = await withOrg(member.orgId, (tx) => tx.property.count());
    if (existing >= max) {
      return { error: LIMIT_MESSAGES.properties(max) };
    }
  }

  await withOrg(member.orgId, async (tx) => {
    await tx.property.create({
      data: {
        orgId: member.orgId,
        name: parsed.data.name,
        type: parsed.data.type,
        address: parsed.data.address || null,
        intro: parsed.data.intro || null,
        rooms: {
          create: parsed.data.rooms.map((room) => ({
            orgId: member.orgId,
            name: room.name,
            capacity: room.capacity,
            basePrice: room.basePrice,
          })),
        },
      },
    });
  });

  revalidatePath("/cho-nghi");
  revalidatePath("/lich");
  redirect("/cho-nghi");
}
