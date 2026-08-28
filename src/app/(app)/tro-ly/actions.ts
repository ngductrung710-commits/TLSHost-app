"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyProposal } from "@/lib/applyProposal";
import { draftProposal } from "@/lib/assistant";
import { canManageBookings, requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { PROPOSAL_TTL_MS } from "@/lib/proposals";

export type AssistantState = { error: string | null };

const askSchema = z.object({
  prompt: z.string().trim().min(3, "Mô tả việc bạn cần làm.").max(2000),
});

export async function ask(
  _prev: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const member = await requireMember();
  if (!canManageBookings(member)) {
    return { error: "Bạn không có quyền dùng trợ lý." };
  }

  const parsed = askSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const outcome = await draftProposal({
    member,
    today: todayIn(member.timezone),
    prompt: parsed.data.prompt,
  });

  if (!outcome.ok) return { error: outcome.error };

  await withOrg(member.orgId, (tx) =>
    tx.aiProposal.create({
      data: {
        orgId: member.orgId,
        prompt: parsed.data.prompt,
        summary: outcome.reply.summary,
        kind: outcome.reply.proposal.kind,
        payload: outcome.reply.proposal,
        expiresAt: new Date(Date.now() + PROPOSAL_TTL_MS),
        createdByMembershipId: member.membershipId,
      },
    }),
  );

  revalidatePath("/tro-ly");
  return { error: null };
}

export async function approve(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!canManageBookings(member)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const proposal = await withOrg(member.orgId, (tx) =>
    tx.aiProposal.findUnique({
      where: { id },
      select: { id: true, status: true, expiresAt: true, payload: true },
    }),
  );

  if (!proposal || proposal.status !== "PENDING") {
    revalidatePath("/tro-ly");
    return;
  }

  // Checked at approval, not only at render. The page that showed the button
  // was drawn on an earlier request, and the whole point of an expiry is that
  // the calendar may have moved since.
  if (proposal.expiresAt <= new Date()) {
    await withOrg(member.orgId, (tx) =>
      tx.aiProposal.update({
        where: { id: proposal.id },
        data: { status: "EXPIRED" },
      }),
    );
    revalidatePath("/tro-ly");
    return;
  }

  const result = await applyProposal({ member, raw: proposal.payload });

  await withOrg(member.orgId, (tx) =>
    tx.aiProposal.update({
      where: { id: proposal.id },
      data: result.ok
        ? {
            status: "APPROVED",
            approvedByUserId: member.userId,
            approvedAt: new Date(),
            error: null,
          }
        : // Left PENDING on failure. The nights being taken is usually
          // temporary, and a host who frees them should be able to approve the
          // same proposal rather than describe it again.
          { error: result.error },
    }),
  );

  revalidatePath("/tro-ly");
  revalidatePath("/lich");
  revalidatePath("/cho-nghi");
}

export async function reject(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!canManageBookings(member)) return;

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await withOrg(member.orgId, (tx) =>
    tx.aiProposal.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED" },
    }),
  );

  revalidatePath("/tro-ly");
}
