"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { prisma, withOrg } from "@/lib/db";
import { hashToken, newToken } from "@/lib/tokens";

export type TeamState = { error: string | null; inviteLink?: string };

const INVITE_DAYS = 14;

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên người bạn muốn mời."),
  email: z.string().trim().toLowerCase().email("Email chưa đúng định dạng."),
  role: z.enum(["COLLABORATOR", "HOUSEKEEPER"]),
  canEditOthersBookings: z.coerce.boolean(),
});

/**
 * Invites someone into this organization.
 *
 * Deliberately does not send email: there is no mail provider wired up yet, and
 * a function that silently fails to deliver is worse than one that hands you a
 * link to send yourself. The link comes back in the result for the owner to
 * copy — over Zalo, which is how this will actually happen.
 */
export async function inviteMember(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const member = await requireMember();
  if (member.role !== "OWNER") {
    return { error: "Chỉ chủ nhà mới mời được người khác." };
  }

  const parsed = inviteSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    canEditOthersBookings: formData.get("canEditOthersBookings") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const { name, email, role, canEditOthersBookings } = parsed.data;

  // Which properties they may see. No boxes ticked means every property, which
  // matches MembershipScope's "no rows means all".
  const propertyIds = formData
    .getAll("propertyIds")
    .map(String)
    .filter(Boolean);

  const token = newToken();
  const tokenHash = hashToken(token);

  try {
    await prisma.$transaction(async (tx) => {
      // The user may already exist — someone can host for two businesses, and
      // an account is per person, not per organization.
      let user = await tx.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (!user) {
        // No passwordHash: the account exists but cannot be signed into until
        // the invitation is accepted and one is set.
        user = await tx.user.create({
          data: { email, name },
          select: { id: true },
        });
      }

      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${member.orgId}, true)`;

      const already = await tx.membership.findFirst({
        where: { orgId: member.orgId, userId: user.id },
        select: { id: true },
      });
      if (already) throw new Error("ALREADY_MEMBER");

      const created = await tx.membership.create({
        data: {
          orgId: member.orgId,
          userId: user.id,
          role,
          canEditOthersBookings:
            role === "COLLABORATOR" ? canEditOthersBookings : false,
          inviteTokenHash: tokenHash,
          inviteExpiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
        },
        select: { id: true },
      });

      if (propertyIds.length > 0) {
        // Row-level security filters this to properties in the caller's org, so
        // an id from elsewhere silently matches nothing rather than granting
        // access to it.
        const owned = await tx.property.findMany({
          where: { id: { in: propertyIds } },
          select: { id: true },
        });
        await tx.membershipScope.createMany({
          data: owned.map((p) => ({
            membershipId: created.id,
            propertyId: p.id,
          })),
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_MEMBER") {
      return { error: "Người này đã ở trong đội của bạn." };
    }
    throw error;
  }

  revalidatePath("/doi-ngu");
  return { error: null, inviteLink: `/tham-gia/${token}` };
}

const updateSchema = z.object({
  membershipId: z.string().min(1),
  canEditOthersBookings: z.coerce.boolean(),
});

export async function updateMember(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (member.role !== "OWNER") return;

  const parsed = updateSchema.safeParse({
    membershipId: formData.get("membershipId"),
    canEditOthersBookings: formData.get("canEditOthersBookings") === "on",
  });
  if (!parsed.success) return;

  await withOrg(member.orgId, async (tx) => {
    const target = await tx.membership.findUnique({
      where: { id: parsed.data.membershipId },
      select: { id: true, role: true },
    });
    // Owners are not scoped and not restricted, so there is nothing on one this
    // toggle could mean.
    if (!target || target.role !== "COLLABORATOR") return;

    await tx.membership.update({
      where: { id: target.id },
      data: { canEditOthersBookings: parsed.data.canEditOthersBookings },
    });
  });

  revalidatePath("/doi-ngu");
}

export async function removeMember(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (member.role !== "OWNER") return;

  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) return;

  await withOrg(member.orgId, async (tx) => {
    const target = await tx.membership.findUnique({
      where: { id: membershipId },
      select: { id: true, role: true, userId: true },
    });
    if (!target) return;

    // An organization without an owner cannot be administered by anyone, and
    // nothing else in the app can put one back. Refuse rather than strand it.
    if (target.role === "OWNER") return;

    await tx.membership.delete({ where: { id: target.id } });
  });

  // No session to clean up: getActiveMember resolves the membership on every
  // request, so the row disappearing is the revocation. This is exactly why
  // sessions are rows and not JWTs — with a token there would be nothing to
  // do here but wait for it to expire.

  revalidatePath("/doi-ngu");
  revalidatePath("/lich");
}
