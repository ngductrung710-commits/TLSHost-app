"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useT } from "@/components/I18nProvider";
import { fill } from "@/lib/i18n";

/**
 * Chọn ngày bắt đầu của bảng lịch, bằng một tháng bày ra dưới tiêu đề.
 *
 * Trước đây chỉ có ‹ Hôm nay › — nghĩa là muốn xem tháng sau phải bấm mũi tên
 * bốn lần, và muốn xem tháng Ba năm sau thì phải bấm mười ba lần. Một cái lịch
 * mà không nhảy được tới một ngày cụ thể là một cái lịch chỉ dùng được cho
 * tuần này.
 *
 * Mọi phép tính ngày ở đây đều theo UTC, giống hệt phần còn lại của ứng dụng.
 * Trộn giờ địa phương vào đây sẽ làm ngày 1 của tháng rơi nhầm cột ở những
 * múi giờ lệch, và lỗi đó chỉ hiện ra với người dùng ở múi giờ khác.
 */

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;
const WEEKDAYS_EN = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Sáu tuần, luôn luôn sáu.
 *
 * Một tháng chiếm bốn tới sáu hàng tuỳ nó bắt đầu vào thứ mấy. Vẽ đúng số
 * hàng cần thiết thì hộp lịch cao thấp khác nhau mỗi lần bấm sang tháng, và
 * cái nút vừa bấm nhảy đi chỗ khác dưới con trỏ. Sáu hàng cố định đắt thêm
 * một hàng ô mờ, và đổi lại là một cái hộp đứng yên.
 */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  // getUTCDay: 0 là Chủ nhật. Tuần ở Việt Nam bắt đầu từ thứ Hai, nên xoay đi
  // một ngày trước khi lấy phần dư.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(year, month, 1 - lead));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

export function MonthPicker({
  label,
  from,
  today,
  locale,
  search,
}: {
  /** Dòng chữ khoảng ngày, do trang tính sẵn. */
  label: string;
  /** Ngày đầu của khoảng đang xem, "YYYY-MM-DD". */
  from: string;
  today: string;
  locale: "vi" | "en";
  /** Từ khoá tìm kiếm đang có, để bấm một ngày không làm mất nó. */
  search: string;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(from + "T00:00:00.000Z");
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const box = useRef<HTMLDivElement>(null);

  // Đóng khi bấm ra ngoài hoặc bấm Esc. Cả hai đều là cách người ta thoát
  // khỏi một hộp bật lên mà không cần tìm nút đóng.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = monthGrid(cursor.year, cursor.month);
  const names = locale === "en" ? WEEKDAYS_EN : WEEKDAYS;

  // Nhánh tiếng Việt dùng khoá có chỗ trống chứ không ghép bằng dấu ngoặc
  // ngược: check:i18n chỉ đọc được chuỗi nằm trong dấu nháy, nên một dấu ngoặc
  // ngược là chỗ tiếng Việt lọt qua mà không ai thấy. Nhánh tiếng Anh thì để
  // trình duyệt tự đặt tên tháng — "September 2026" là thứ Intl biết rõ hơn
  // bất kỳ bảng chép tay nào.
  const monthLabel =
    locale === "en"
      ? new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : fill(t("Tháng {thang} năm {nam}"), {
          thang: cursor.month + 1,
          nam: cursor.year,
        });

  const step = (by: number) =>
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month + by, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  const go = (date: Date) => {
    const q = new URLSearchParams({ tu: iso(date) });
    if (search) q.set("tim", search);
    setOpen(false);
    router.push(`/lich?${q.toString()}`);
  };

  return (
    <div ref={box} className="relative ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[15px] font-semibold text-ink-900 transition-colors hover:bg-sand-100"
      >
        {label}
        <span aria-hidden="true" className="text-[11px] text-ink-500">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("Chọn ngày")}
          className="absolute left-0 top-full z-30 mt-2 w-[19.5rem] rounded-2xl border border-line bg-surface p-3 shadow-lg"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t("Tháng trước")}
              className="grid size-8 place-items-center rounded-full text-ink-600 hover:bg-sand-100"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <span className="text-[14px] font-semibold text-ink-900">{monthLabel}</span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t("Tháng sau")}
              className="grid size-8 place-items-center rounded-full text-ink-600 hover:bg-sand-100"
            >
              <span aria-hidden="true">›</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {names.map((n) => (
              <div
                key={n}
                className="py-1 text-center text-[11px] font-medium text-ink-400"
              >
                {n}
              </div>
            ))}

            {days.map((day) => {
              const key = iso(day);
              const outside = day.getUTCMonth() !== cursor.month;
              const isToday = key === today;
              const isFrom = key === from;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => go(day)}
                  aria-current={isToday ? "date" : undefined}
                  className={[
                    "mx-auto grid size-9 place-items-center rounded-full text-[13px] tnum transition-colors",
                    isToday
                      ? "bg-ink-900 font-semibold text-sand-100"
                      : isFrom
                        ? "border border-ink-900 font-semibold text-ink-900"
                        : outside
                          ? "text-ink-300 hover:bg-sand-100"
                          : "text-ink-800 hover:bg-sand-100",
                  ].join(" ")}
                >
                  {day.getUTCDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
