import type { Metadata } from "next";
import Link from "next/link";

import { withOrg, withPublicSlug } from "@/lib/db";
import { THEMES, themeVars, type BookingTheme } from "@/lib/themes";

import { settlePayment } from "../thanh-toan/actions";

export const metadata: Metadata = {
  title: "Đã nhận đặt phòng",
  robots: { index: false, follow: false },
};

export default async function BookedPage(props: PageProps<"/dat/[slug]/xong">) {
  const { slug } = await props.params;
  const params = await props.searchParams;

  // Stripe substitutes its id into ?tt=; PayPal appends its own ?token=.
  // Both land here, and neither is trusted for anything beyond "look up a
  // payment we ourselves created" — the id is matched against a row in this
  // org before a single call goes out to a provider.
  const back = typeof params.tt === "string" ? params.tt : null;
  const paypal = typeof params.token === "string" ? params.token : null;
  const externalId = back ?? paypal;

  // The theme has to be looked up again here. This is a separate route, so it
  // does not inherit the booking page's wrapper — and a confirmation rendered
  // in the default palette after a page in the host's own look reads as a
  // different site, which is the moment a guest wonders whether their booking
  // went somewhere it should not have.
  const found = await withPublicSlug(slug, (tx) =>
    tx.property.findFirst({
      where: { publicSlug: slug, published: true },
      select: { orgId: true, name: true },
    }),
  );

  const org = found
    ? await withOrg(found.orgId, (tx) =>
        tx.organization.findUnique({
          where: { id: found.orgId },
          select: { bookingTheme: true, brandColor: true },
        }),
      )
    : null;

  // A guest who paid must be told so, and a guest who did not must not be. The
  // provider is the authority on which happened, so it is asked here rather
  // than inferring anything from the fact that they came back at all — a guest
  // can reach this URL by pressing back, or by closing the checkout.
  const settled =
    found && externalId ? await settlePayment(found.orgId, externalId) : null;

  const theme = (org?.bookingTheme ?? "CLASSIC") as BookingTheme;
  const vars = themeVars(theme, org?.brandColor ?? null);

  return (
    <div
      style={vars as React.CSSProperties}
      className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]"
    >
      <main className="mx-auto w-full max-w-lg px-5 py-20 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
          Đã xác nhận
        </p>
        <h1
          className="mt-3 text-[2rem] font-semibold leading-tight"
          style={{ fontFamily: THEMES[theme].display }}
        >
          Phòng của bạn đã được giữ.
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-[var(--ink-soft)]">
          Những đêm bạn chọn đã khoá lại ngay trên lịch của chủ nhà — và trên
          mọi kênh khác. Chủ nhà sẽ liên hệ để sắp xếp phần còn lại.
        </p>

        {settled === "paid" ? (
          <p
            role="status"
            className="mx-auto mt-6 max-w-sm rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[15px] leading-relaxed"
          >
            Đã nhận thanh toán. Cảm ơn bạn.
          </p>
        ) : settled === "pending" ? (
          <p
            role="status"
            className="mx-auto mt-6 max-w-sm rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-[15px] leading-relaxed text-[var(--ink-soft)]"
          >
            Chưa xác nhận được thanh toán. Phòng vẫn là của bạn — chủ nhà sẽ
            liên hệ để thu xếp.
          </p>
        ) : null}
        <p className="mt-8">
          <Link
            href={`/dat/${slug}`}
            className="text-[15px] font-semibold underline underline-offset-4"
          >
            Về {found?.name ?? "trang chỗ nghỉ"}
          </Link>
        </p>
      </main>
    </div>
  );
}
