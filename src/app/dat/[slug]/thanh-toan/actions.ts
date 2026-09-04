"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { withOrg, withPublicSlug } from "@/lib/db";
import { createCheckout, verifyPayment } from "@/lib/payments";
import { guestT } from "@/lib/guestLocale";

export type PayState = { error: string | null };

const startSchema = z.object({
  slug: z.string().min(1),
  bookingId: z.string().min(1),
  provider: z.enum(["STRIPE", "PAYPAL"]),
});

async function origin(): Promise<string> {
  const head = await headers();
  const host = head.get("host") ?? "localhost:3001";
  const proto =
    head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Opens a checkout with the host's own provider and sends the guest to it.
 *
 * Every failure here is recoverable by doing nothing: the booking already
 * exists and the nights are already held. A provider being down means the
 * guest pays on arrival, which is how most stays in Vietnam are paid anyway.
 */
export async function startPayment(
  _prev: PayState,
  formData: FormData,
): Promise<PayState> {
  // Same hidden field the booking widget posts, and the same reason: a
  // server action has no URL to read the language off.
  const locale = formData.get("ng") === "en" ? "en" : "vi";
  const t = guestT(locale);

  const parsed = startSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("Yêu cầu không hợp lệ.") };

  const { slug, bookingId, provider } = parsed.data;

  const found = await withPublicSlug(slug, (tx) =>
    tx.property.findFirst({
      where: { publicSlug: slug, published: true },
      select: { id: true, orgId: true, name: true },
    }),
  );
  if (!found) return { error: t("Không tìm thấy chỗ nghỉ này.") };

  const data = await withOrg(found.orgId, async (tx) => {
    // The booking must belong to this property. A booking id from elsewhere
    // must not be payable through this page.
    const booking = await tx.booking.findFirst({
      where: {
        id: bookingId,
        status: { not: "CANCELLED" },
        room: { propertyId: found.id },
      },
      select: { id: true, totalCents: true, guestName: true },
    });
    if (!booking) return null;

    const account = await tx.paymentAccount.findFirst({
      where: { provider, verifiedAt: { not: null } },
      select: { provider: true, publicId: true, secretEnc: true, live: true },
    });
    if (!account) return null;

    const org = await tx.organization.findUnique({
      where: { id: found.orgId },
      select: { currency: true },
    });

    // Already paid? Then there is nothing to open, and opening one would
    // invite a second charge.
    const settled = await tx.payment.findFirst({
      where: { bookingId: booking.id, status: "PAID" },
      select: { id: true },
    });

    return { booking, account, currency: org?.currency ?? "VND", settled };
  });

  if (!data) {
    return { error: t("Chưa thanh toán trực tuyến được cho lượt đặt này.") };
  }
  if (data.settled) return { error: t("Lượt đặt này đã thanh toán rồi.") };
  if (data.booking.totalCents === null || data.booking.totalCents <= 0) {
    return { error: t("Lượt đặt này chưa có số tiền để thanh toán.") };
  }

  const base = await origin();

  // The return URL has to carry the checkout's own id, and neither provider
  // hands that over before the checkout exists. They solve it differently and
  // both have to be right, or a guest pays and comes back to a page that
  // cannot tell.
  //
  //   Stripe substitutes {CHECKOUT_SESSION_ID} into the URL itself.
  //   PayPal appends ?token=<order id> to whatever it is given.
  //
  // A first draft sent an empty `?tt=` to both, which would have taken money
  // and then reported it unpaid.
  const lang = locale === "en" ? "ng=en" : "";
  const successUrl =
    provider === "STRIPE"
      ? `${base}/dat/${slug}/xong?tt={CHECKOUT_SESSION_ID}${lang ? `&${lang}` : ""}`
      : `${base}/dat/${slug}/xong${lang ? `?${lang}` : ""}`;

  const checkout = await createCheckout(data.account, {
    amount: data.booking.totalCents,
    currency: data.currency,
    description: `${found.name} — ${data.booking.guestName}`,
    successUrl,
    cancelUrl: `${base}/dat/${slug}/thanh-toan?dat=${data.booking.id}&huy=1${lang ? `&${lang}` : ""}`,
  });

  if (!checkout.ok) return { error: t(checkout.error) };

  await withOrg(found.orgId, (tx) =>
    tx.payment.create({
      data: {
        orgId: found.orgId,
        bookingId: data.booking.id,
        provider,
        externalId: checkout.externalId,
        amount: data.booking.totalCents!,
        currency: data.currency,
      },
    }),
  );

  redirect(checkout.url);
}

/**
 * Settles a payment after the guest comes back.
 *
 * Called from the confirmation page. Safe to run twice: a payment already
 * marked PAID is left alone, and PayPal's "already captured" is treated as
 * success rather than an error, because a guest refreshing the return page is
 * ordinary behaviour.
 */
export async function settlePayment(
  orgId: string,
  externalId: string,
): Promise<"paid" | "pending" | "unknown"> {
  const row = await withOrg(orgId, (tx) =>
    tx.payment.findFirst({
      where: { externalId },
      select: { id: true, status: true, provider: true, amount: true },
    }),
  );
  if (!row) return "unknown";
  if (row.status === "PAID") return "paid";

  const account = await withOrg(orgId, (tx) =>
    tx.paymentAccount.findFirst({
      where: { provider: row.provider },
      select: { provider: true, publicId: true, secretEnc: true, live: true },
    }),
  );
  if (!account) return "pending";

  const result = await verifyPayment(account, externalId);
  if (!result.ok) return "pending";

  if (!result.paid) return "pending";

  // The amount is checked, not assumed. A provider reporting a smaller
  // capture than the booking's total means something is wrong upstream, and
  // marking it paid would hide that from the host.
  if (result.amount !== null && result.amount < row.amount) {
    await withOrg(orgId, (tx) =>
      tx.payment.update({
        where: { id: row.id },
        data: { status: "FAILED" },
      }),
    );
    return "pending";
  }

  await withOrg(orgId, (tx) =>
    tx.payment.update({
      where: { id: row.id },
      data: { status: "PAID", paidAt: new Date() },
    }),
  );
  return "paid";
}
