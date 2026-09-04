import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { withOrg, withPublicSlug } from "@/lib/db";
import { formatMoney, shortVi } from "@/lib/dates";
import { THEMES, themeVars, type BookingTheme } from "@/lib/themes";

import { PayForm } from "./PayForm";
import { startPayment } from "./actions";

export const metadata: Metadata = {
  title: "Thanh toán",
  robots: { index: false, follow: false },
};

/**
 * Offered after a booking is made, never before it.
 *
 * The nights are already held by the time a guest sees this. Paying now is a
 * convenience, not a condition — a provider being down, a card being declined,
 * or a guest simply closing the tab all end with a booking that still exists
 * and a host who gets paid on arrival. That is how most stays in Vietnam are
 * paid anyway, and building it the other way round would mean a payment
 * failure could lose a booking.
 */
export default async function PaymentPage(
  props: PageProps<"/dat/[slug]/thanh-toan">,
) {
  const { slug } = await props.params;
  const params = await props.searchParams;
  const bookingId = typeof params.dat === "string" ? params.dat : null;
  const cancelled = params.huy === "1";

  const found = await withPublicSlug(slug, (tx) =>
    tx.property.findFirst({
      where: { publicSlug: slug, published: true },
      select: { id: true, orgId: true, name: true },
    }),
  );
  if (!found || !bookingId) notFound();

  const data = await withOrg(found.orgId, async (tx) => {
    const booking = await tx.booking.findFirst({
      where: {
        id: bookingId,
        status: { not: "CANCELLED" },
        room: { propertyId: found.id },
      },
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        totalCents: true,
        room: { select: { name: true } },
      },
    });
    if (!booking) return null;

    const accounts = await tx.paymentAccount.findMany({
      where: { verifiedAt: { not: null } },
      select: { provider: true },
    });

    const paid = await tx.payment.findFirst({
      where: { bookingId: booking.id, status: "PAID" },
      select: { id: true },
    });

    const org = await tx.organization.findUnique({
      where: { id: found.orgId },
      select: { bookingTheme: true, brandColor: true, currency: true },
    });

    return { booking, accounts, paid, org };
  });

  if (!data) notFound();

  const theme = (data.org?.bookingTheme ?? "CLASSIC") as BookingTheme;
  const vars = themeVars(theme, data.org?.brandColor ?? null);
  const providers = data.accounts.map((a) => a.provider);
  const payable =
    !data.paid && providers.length > 0 && (data.booking.totalCents ?? 0) > 0;

  return (
    <div
      style={vars as React.CSSProperties}
      className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]"
    >
      <main className="mx-auto w-full max-w-md px-5 py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          Đã giữ phòng
        </p>
        <h1
          className="mt-2 text-[1.75rem] font-semibold leading-tight"
          style={{ fontFamily: THEMES[theme].display }}
        >
          {found.name}
        </h1>

        <dl className="mt-6 space-y-2 border-y border-[var(--line)] py-5 text-[15px]">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--ink-soft)]">Phòng</dt>
            <dd className="font-medium">{data.booking.room.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--ink-soft)]">Ngày</dt>
            <dd className="font-medium tnum">
              {shortVi(data.booking.checkIn)} – {shortVi(data.booking.checkOut)}
            </dd>
          </div>
          {data.booking.totalCents !== null ? (
            <div className="flex justify-between gap-4 pt-1">
              <dt className="text-[var(--ink-soft)]">Tổng cộng</dt>
              <dd className="text-[17px] font-semibold tnum">
                {formatMoney(data.booking.totalCents, data.org?.currency ?? "VND")}
              </dd>
            </div>
          ) : null}
        </dl>

        {cancelled ? (
          <p
            role="status"
            className="mt-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[14px] leading-relaxed text-[var(--ink-soft)]"
          >
            Bạn đã thoát khỏi trang thanh toán. Phòng vẫn được giữ — trả sau
            cũng được.
          </p>
        ) : null}

        {data.paid ? (
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--ink-soft)]">
            Lượt đặt này đã thanh toán. Hẹn gặp bạn.
          </p>
        ) : payable ? (
          <div className="mt-6">
            <PayForm
              action={startPayment}
              slug={slug}
              bookingId={data.booking.id}
              providers={providers}
            />
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--ink-soft)]">
              Trả trước hay trả khi nhận phòng đều được — phòng đã là của bạn.
              Tiền vào thẳng tài khoản của chủ nhà.
            </p>
          </div>
        ) : (
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--ink-soft)]">
            Chỗ nghỉ này nhận thanh toán khi bạn tới. Chủ nhà sẽ liên hệ để sắp
            xếp phần còn lại.
          </p>
        )}

        <p className="mt-10">
          <Link
            href={`/dat/${slug}`}
            className="text-[14px] font-semibold underline underline-offset-4"
          >
            Về {found.name}
          </Link>
        </p>
      </main>
    </div>
  );
}
