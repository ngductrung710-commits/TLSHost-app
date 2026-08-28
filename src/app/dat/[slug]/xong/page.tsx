import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Đã nhận đặt phòng",
  robots: { index: false, follow: false },
};

export default async function BookedPage(props: PageProps<"/dat/[slug]/xong">) {
  const { slug } = await props.params;

  return (
    <main className="mx-auto w-full max-w-lg px-5 py-20 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-positive">
        Đã xác nhận
      </p>
      <h1 className="mt-3 text-[2rem] font-semibold leading-tight text-ink-900">
        Phòng của bạn đã được giữ.
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
        Những đêm bạn chọn đã khoá lại ngay trên lịch của chủ nhà — và trên mọi
        kênh khác. Chủ nhà sẽ liên hệ để sắp xếp phần còn lại.
      </p>
      <p className="mt-8">
        <Link
          href={`/dat/${slug}`}
          className="text-[15px] font-semibold text-ink-900 underline underline-offset-4"
        >
          Về trang chỗ nghỉ
        </Link>
      </p>
    </main>
  );
}
