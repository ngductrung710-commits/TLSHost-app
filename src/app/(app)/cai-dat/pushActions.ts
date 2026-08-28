"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { keysAreUsable, notifyOrg } from "@/lib/push";

export type PushState = { error: string | null; notice?: string };

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(300),
});

/**
 * Records a browser's push subscription.
 *
 * The endpoint is unique, because a browser reissues the same one for the same
 * device: re-subscribing has to update the row rather than add another, or a
 * host who taps the button twice gets every notification twice.
 */
export async function subscribePush(formData: FormData): Promise<void> {
  const member = await requireMember();

  const parsed = subscribeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  const { endpoint, p256dh, auth, userAgent } = parsed.data;

  // Refused rather than stored. Keys that cannot be used fail on every send
  // with no HTTP status, so the dead-subscription cleanup never removes them
  // and the row sticks around failing forever.
  if (!keysAreUsable(p256dh, auth)) return;

  await withOrg(member.orgId, (tx) =>
    tx.pushSubscription.upsert({
      where: { endpoint },
      create: {
        orgId: member.orgId,
        userId: member.userId,
        endpoint,
        p256dh,
        auth,
        userAgent: userAgent || null,
      },
      // The keys rotate when a browser re-subscribes, and the row may belong
      // to a different person if two people share a device. Both get updated.
      update: {
        orgId: member.orgId,
        userId: member.userId,
        p256dh,
        auth,
        userAgent: userAgent || null,
      },
    }),
  );

  revalidatePath("/cai-dat");
}

export async function unsubscribePush(formData: FormData): Promise<void> {
  const member = await requireMember();

  const endpoint = String(formData.get("endpoint") ?? "");
  if (!endpoint) return;

  await withOrg(member.orgId, (tx) =>
    tx.pushSubscription.deleteMany({ where: { endpoint } }),
  );

  revalidatePath("/cai-dat");
}

/**
 * Sends one notification to this device, so a host can see what they signed up
 * for before a real booking arrives at two in the morning.
 */
export async function sendTestPush(): Promise<void> {
  const member = await requireMember();

  await notifyOrg(member.orgId, {
    title: "TLSHost",
    body: "Thông báo đang hoạt động. Đặt phòng mới sẽ hiện như thế này.",
    url: "/tong-quan",
  });

  revalidatePath("/cai-dat");
}
