"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { applyProposal } from "@/lib/applyProposal";
import { draftProposal } from "@/lib/assistant";
import { canManageBookings, requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { LIMIT_MESSAGES } from "@/lib/plans";
import { PROPOSAL_TTL_MS } from "@/lib/proposals";
import { getT, readLocale } from "@/lib/locale";

/**
 * What comes back from one ask.
 *
 * `drafted` exists for the side panel. The page re-renders from the database
 * after revalidatePath and needs nothing here, but the panel floats over
 * whatever screen the host was on — revalidating that screen to show one new
 * proposal would redraw a calendar underneath them for no reason. So the
 * proposal comes back with the reply and the panel appends it to the thread on
 * screen, while the database stays the record.
 */
export type Drafted = {
  id: string;
  summary: string;
  kind: string;
  expiresAt: string;
};

export type AssistantState = {
  error: string | null;
  drafted?: Drafted | null;
};

const askSchema = z.object({
  prompt: z.string().trim().min(3, "Mô tả việc bạn cần làm.").max(2000),
});

export async function ask(
  _prev: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const t = await getT();
  const member = await requireMember();
  if (!canManageBookings(member)) {
    return { error: t("Bạn không có quyền dùng trợ lý.") };
  }
  if (!member.limits.assistant) {
    return { error: LIMIT_MESSAGES.assistant };
  }

  const parsed = askSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("Thông tin chưa hợp lệ.") };
  }

  const outcome = await draftProposal({
    member,
    today: todayIn(member.timezone),
    prompt: parsed.data.prompt,
    locale: await readLocale(),
  });

  if (!outcome.ok) return { error: outcome.error };

  const expiresAt = new Date(Date.now() + PROPOSAL_TTL_MS);
  const created = await withOrg(member.orgId, (tx) =>
    tx.aiProposal.create({
      data: {
        orgId: member.orgId,
        prompt: parsed.data.prompt,
        summary: outcome.reply.summary,
        kind: outcome.reply.proposal.kind,
        payload: outcome.reply.proposal,
        expiresAt,
        createdByMembershipId: member.membershipId,
      },
      select: { id: true },
    }),
  );

  revalidatePath("/tro-ly");
  return {
    error: null,
    drafted: {
      id: created.id,
      summary: outcome.reply.summary,
      kind: outcome.reply.proposal.kind,
      // Serialised: a Date crosses the server-action boundary fine, but the
      // panel only ever formats it, and a string is one less thing that can
      // arrive as an empty object after a serialisation change.
      expiresAt: expiresAt.toISOString(),
    },
  };
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
  // The panel is reachable from every screen, so an approval can land while
  // the host is looking at the dashboard or the sales report. Those read the
  // same rows the approval just changed.
  revalidatePath("/tong-quan");
  revalidatePath("/ban-hang");
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
