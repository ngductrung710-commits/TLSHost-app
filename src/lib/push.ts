import "server-only";

import { createECDH } from "node:crypto";

import webpush from "web-push";

import { withOrg } from "@/lib/db";

/**
 * Push notifications for new bookings.
 *
 * The only thing this app sends unprompted, and it says as little as it can:
 * a guest's name and a room, no phone number, no price. A notification lands
 * on a lock screen where anyone standing nearby can read it, and a host
 * showing their phone to a friend should not be showing them a stranger's
 * contact details.
 *
 * Every send is best-effort. A push that fails must never take a booking down
 * with it — the booking is the thing that matters, the buzz is a courtesy.
 */

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:noreply@tlshost.vn";

/** Whether push is configured at all. The UI asks before offering the button. */
export function pushConfigured(): boolean {
  return Boolean(PUBLIC_KEY && PRIVATE_KEY);
}

let ready = false;
function configure(): boolean {
  if (!pushConfigured()) return false;
  if (!ready) {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);
    ready = true;
  }
  return true;
}

/**
 * Whether a browser's keys can actually be used.
 *
 * A row holding unusable keys fails on every send with no HTTP status at all,
 * so the dead-subscription cleanup below never sees it and the worker retries
 * it forever. Checked here so such a row cannot be written.
 *
 * The point is loaded rather than measured. A first version checked only the
 * shape — 65 bytes beginning 0x04, which is what an uncompressed P-256 point
 * looks like — and accepted an invented key that had exactly that shape and
 * was not on the curve. setPublicKey does the arithmetic and throws when the
 * point is not a real one, which is the same thing web-push does later and the
 * only check that agrees with it.
 */
export function keysAreUsable(p256dh: string, auth: string): boolean {
  try {
    if (Buffer.from(auth, "base64url").length !== 16) return false;
    const ecdh = createECDH("prime256v1");
    ecdh.setPublicKey(Buffer.from(p256dh, "base64url"));
    return true;
  } catch {
    return false;
  }
}

export type Notification = {
  title: string;
  body: string;
  /** Where clicking it should land. */
  url: string;
};

/**
 * Sends to every device signed in to this organization.
 *
 * Subscriptions the push service rejects are deleted rather than retried. A
 * 404 or 410 from it means the browser is gone — the app was uninstalled, the
 * site data was cleared — and keeping the row means failing forever on every
 * future booking.
 */
export async function notifyOrg(
  orgId: string,
  notification: Notification,
): Promise<{ sent: number; removed: number }> {
  if (!configure()) return { sent: 0, removed: 0 };

  const subs = await withOrg(orgId, (tx) =>
    tx.pushSubscription.findMany({
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    }),
  );

  if (subs.length === 0) return { sent: 0, removed: 0 };

  const payload = JSON.stringify(notification);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 },
        );
        sent += 1;
      } catch (error) {
        const status =
          typeof error === "object" && error !== null
            ? (error as { statusCode?: number }).statusCode
            : undefined;
        // 404 and 410 are the push service saying this endpoint is retired —
        // measured against real services: FCM answers 410, Mozilla 404.
        // Anything else is transient and worth keeping the row for.
        if (status === 404 || status === 410) dead.push(sub.id);
      }
    }),
  );

  if (dead.length > 0) {
    await withOrg(orgId, (tx) =>
      tx.pushSubscription.deleteMany({ where: { id: { in: dead } } }),
    );
  }

  if (sent > 0) {
    await withOrg(orgId, (tx) =>
      tx.pushSubscription.updateMany({
        where: { id: { in: subs.filter((s) => !dead.includes(s.id)).map((s) => s.id) } },
        data: { lastSentAt: new Date() },
      }),
    );
  }

  return { sent, removed: dead.length };
}

/**
 * Fire-and-forget wrapper for the booking path.
 *
 * A guest pressing "book" must not wait on a push service, and must not see an
 * error because one was slow. The booking is already written by the time this
 * runs; whether a phone buzzes is not the guest's problem.
 */
export function notifyOrgInBackground(
  orgId: string,
  notification: Notification,
): void {
  void notifyOrg(orgId, notification).catch(() => {});
}
