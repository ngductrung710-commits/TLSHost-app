import type { Metadata } from "next";
import Link from "next/link";

import { withOrg, withPublicSlug } from "@/lib/db";
import { THEMES, themeVars, type BookingTheme } from "@/lib/themes";

export const metadata: Metadata = {
  title: "Đã nhận đặt phòng",
  robots: { index: false, follow: false },
};

export default async function BookedPage(props: PageProps<"/dat/[slug]/xong">) {
  const { slug } = await props.params;

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
