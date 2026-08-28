"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";

export type PropertyState = { error: string | null };

const schema = z.object({
  name: z.string().trim().min(1, "Đặt tên cho chỗ nghỉ."),
  address: z.string().trim(),
  // One room per line. A villa rented whole is one property with one room —
  // keeping every bookable thing a Room means the overlap constraint has
  // exactly one shape to enforce.
  rooms: z.string(),
});

export async function createProperty(
  _prev: PropertyState,
  formData: FormData,
): Promise<PropertyState> {
  const member = await requireMember();

  // Only an owner shapes the inventory. A collaborator manages bookings inside
  // the properties they were given; letting them add properties would put
  // rooms outside anyone's scope.
  if (member.role !== "OWNER") {
    return { error: "Chỉ chủ nhà mới thêm được chỗ nghỉ." };
  }

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const roomNames = parsed.data.rooms
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (roomNames.length === 0) {
    return { error: "Cần ít nhất một phòng — mỗi dòng một phòng." };
  }

  const duplicates = roomNames.length !== new Set(roomNames).size;
  if (duplicates) {
    return { error: "Có tên phòng bị trùng. Mỗi phòng cần một tên riêng." };
  }

  await withOrg(member.orgId, async (tx) => {
    await tx.property.create({
      data: {
        orgId: member.orgId,
        name: parsed.data.name,
        address: parsed.data.address || null,
        rooms: {
          create: roomNames.map((name) => ({ name, orgId: member.orgId })),
        },
      },
    });
  });

  revalidatePath("/cho-nghi");
  revalidatePath("/lich");
  redirect("/cho-nghi");
}
