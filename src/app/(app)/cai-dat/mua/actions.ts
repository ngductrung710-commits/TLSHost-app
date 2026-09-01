"use server";

import { redirect } from "next/navigation";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { getT } from "@/lib/locale";
import type { Plan } from "@/lib/plans";
import { createPurchase } from "@/lib/purchases";

export type BuyState = { error: string | null };

/**
 * Open a purchase and send the host to the payment instructions.
 *
 * Creating one is deliberately cheap: it writes a PENDING row and nothing
 * else. A host who opens this and changes their mind leaves an unpaid row
 * behind, which is the correct amount of consequence for changing your mind.
 */
export async function startPurchase(
  _prev: BuyState,
  formData: FormData,
): Promise<BuyState> {
  const t = await getT();
  const member = await requireMember();

  // Buying is spending. A collaborator manages bookings; committing the
  // organization to a payment is not part of that.
  if (member.role !== "OWNER") {
    return { error: t("Chỉ chủ nhà mới đổi được gói.") };
  }

  const plan = String(formData.get("plan") ?? "");
  if (plan !== "CHANNELS" && plan !== "PRO") {
    return { error: t("Gói này không mua được.") };
  }

  let purchaseId: string | null = null;

  await withOrg(member.orgId, async (tx) => {
    const org = await tx.organization.findUniqueOrThrow({
      where: { id: member.orgId },
      select: { plan: true, planUntil: true },
    });

    const created = await createPurchase(
      tx,
      member.orgId,
      plan as Exclude<Plan, "FREE">,
      { plan: org.plan, planUntil: org.planUntil },
    );
    purchaseId = created?.id ?? null;
  });

  if (purchaseId === null) {
    return {
      error: t("Gói hiện tại đang không có hạn kết thúc, mua thêm một tháng sẽ rút ngắn lại. Liên hệ chúng tôi thay vì mua ở đây."),
    };
  }

  redirect(`/cai-dat/mua/${purchaseId}`);
}
