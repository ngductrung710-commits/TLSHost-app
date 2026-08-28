import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Không có mạng",
  robots: { index: false, follow: false },
};

/**
 * Shown when a navigation fails and there is no network.
 *
 * Deliberately empty of data. The service worker could have cached the
 * calendar and shown that instead, and it does not: a board saying a room is
 * free when it was booked an hour ago is the single worst thing this app could
 * display, and "no signal" is a smaller problem than a double booking.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
        Không có mạng
      </p>
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight text-ink-900">
        Chưa kết nối được
      </h1>
      <p className="mt-4 text-[16px] leading-relaxed text-ink-600">
        TLSHost không hiển thị lịch khi ngoại tuyến. Một bảng lịch cũ nói phòng
        còn trống trong khi đã có khách là điều tệ nhất có thể xảy ra ở đây, nên
        thà không hiện gì.
      </p>
      <p className="mt-6 text-[14px] text-ink-500">
        Có mạng trở lại, tải lại trang là xong.
      </p>
    </main>
  );
}
