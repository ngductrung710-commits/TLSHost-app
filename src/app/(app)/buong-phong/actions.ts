"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember, visiblePropertyFilter } from "@/lib/dal";
import { withOrg } from "@/lib/db";

const markSchema = z.object({
  roomId: z.string().min(1),
  state: z.enum(["CLEAN", "DIRTY", "INSPECTED", "MAINTENANCE"]),
});

/**
 * Sets one room's state.
 *
 * Housekeepers may mark clean and nothing else. Inspected is a manager's word
 * for "I have looked", which is worth nothing if the person who cleaned it can
 * say it about their own work; maintenance takes a room out of service, which
 * is a decision about the business rather than about the room.
 */
export async function markRoom(formData: FormData): Promise<void> {
  const member = await requireMember();

  const parsed = markSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { roomId, state } = parsed.data;

  if (member.role === "HOUSEKEEPER" && state !== "CLEAN") return;

  await withOrg(member.orgId, async (tx) => {
    // Scoped, not just org-scoped. A collaborator or housekeeper given two
    // properties must not be able to mark a room in a third.
    const room = await tx.room.findFirst({
      where: { id: roomId, property: visiblePropertyFilter(member) },
      select: { id: true },
    });
    if (!room) return;

    await tx.room.update({
      where: { id: room.id },
      data:
        state === "CLEAN" || state === "INSPECTED"
          ? {
              cleanState: state,
              // Stamped only when the room actually becomes clean. This is the
              // value the "has a guest left since?" comparison reads, so
              // writing it on a DIRTY mark would make the room look freshly
              // cleaned at the moment someone said it was not.
              cleanedAt: new Date(),
              cleanedByMembershipId: member.membershipId,
            }
          : { cleanState: state },
    });
  });

  revalidatePath("/buong-phong");
  revalidatePath("/lich");
}

/**
 * Marks every room that currently needs cleaning as clean.
 *
 * The one bulk action on this screen, and deliberately narrow: it touches only
 * rooms that need it, never a room under maintenance, and never a room outside
 * this member's scope.
 */
export async function markAllClean(): Promise<void> {
  const member = await requireMember();

  await withOrg(member.orgId, async (tx) => {
    const rooms = await tx.room.findMany({
      where: {
        property: visiblePropertyFilter(member),
        cleanState: { not: "MAINTENANCE" },
      },
      select: { id: true },
    });
    if (rooms.length === 0) return;

    await tx.room.updateMany({
      where: { id: { in: rooms.map((r) => r.id) } },
      data: {
        cleanState: "CLEAN",
        cleanedAt: new Date(),
        cleanedByMembershipId: member.membershipId,
      },
    });
  });

  revalidatePath("/buong-phong");
  revalidatePath("/lich");
}
