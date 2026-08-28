"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { testCredentials } from "@/lib/payments";
import { encryptSecret, secretsConfigured } from "@/lib/secrets";

export type PaymentState = { error: string | null; notice?: string };

const connectSchema = z.object({
  provider: z.enum(["STRIPE", "PAYPAL"]),
  publicId: z.string().trim().min(8, "Thiếu khoá công khai / client ID."),
  secret: z.string().trim().min(8, "Thiếu khoá bí mật."),
  live: z.coerce.boolean(),
});

/**
 * Stores a host's own payment credentials, after proving they work.
 *
 * The test call happens before the row is written, not after. A host who
 * pastes the wrong key should be told at the moment they paste it — the
 * alternative is a "connected" badge that turns out to be false the first time
 * a guest tries to pay, which is the worst possible moment to find out.
 */
export async function connectPayments(
  _prev: PaymentState,
  formData: FormData,
): Promise<PaymentState> {
  const member = await requireMember();
  if (member.role !== "OWNER") {
    return { error: "Chỉ chủ nhà mới kết nối được cổng thanh toán." };
  }
  if (!secretsConfigured()) {
    return {
      error:
        "Máy chủ chưa có SECRET_KEY nên chưa lưu khoá thanh toán an toàn được. Xem README.",
    };
  }

  const parsed = connectSchema.safeParse({
    provider: formData.get("provider"),
    publicId: formData.get("publicId"),
    secret: formData.get("secret"),
    live: formData.get("live") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const { provider, publicId, secret, live } = parsed.data;

  // A live Stripe key on a sandbox toggle, or the reverse, is a whole evening
  // of confusion. Stripe says which it is in the key itself.
  if (provider === "STRIPE") {
    if (live && secret.startsWith("sk_test_")) {
      return { error: "Đây là khoá thử nghiệm nhưng bạn đã bật chế độ thật." };
    }
    if (!live && secret.startsWith("sk_live_")) {
      return { error: "Đây là khoá thật nhưng bạn đang để chế độ thử nghiệm." };
    }
  }

  const secretEnc = encryptSecret(secret);

  const test = await testCredentials({ provider, publicId, secretEnc, live });
  if (!test.ok) return { error: test.error };

  await withOrg(member.orgId, (tx) =>
    tx.paymentAccount.upsert({
      where: { orgId_provider: { orgId: member.orgId, provider } },
      create: {
        orgId: member.orgId,
        provider,
        publicId,
        secretEnc,
        live,
        verifiedAt: new Date(),
      },
      update: { publicId, secretEnc, live, verifiedAt: new Date(), lastError: null },
    }),
  );

  revalidatePath("/cai-dat");
  return {
    error: null,
    notice: `Đã kết nối ${provider === "STRIPE" ? "Stripe" : "PayPal"}${
      live ? "" : " (chế độ thử nghiệm)"
    }.`,
  };
}

export async function disconnectPayments(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (member.role !== "OWNER") return;

  const provider = String(formData.get("provider") ?? "");
  if (provider !== "STRIPE" && provider !== "PAYPAL") return;

  // Payment rows survive. They record money that moved, and deleting them
  // because a host swapped providers would erase the answer to "did this guest
  // pay".
  await withOrg(member.orgId, (tx) =>
    tx.paymentAccount.deleteMany({ where: { provider } }),
  );

  revalidatePath("/cai-dat");
}
