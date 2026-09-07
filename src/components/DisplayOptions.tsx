"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useT } from "@/components/I18nProvider";

/**
 * Tùy chọn hiển thị của bảng lịch: thu phóng, mật độ hàng, và chú thích màu.
 *
 * Cả hai tùy chọn chỉ đổi hai biến CSS trên chính cái bảng — không tải lại
 * trang, không gọi máy chủ, không nằm trong địa chỉ. Đó là chủ ý: bề rộng cột
 * là sở thích của người đang nhìn, khác hẳn với "đang xem tuần nào", vốn nằm
 * trong URL để gửi được cho người khác. Gửi cho đồng nghiệp một cái link kèm
 * theo cỡ chữ của mình là gửi nhầm thứ.
 *
 * Lưu trong localStorage nên nó theo người chứ không theo phiên. Mọi lần đọc
 * ghi đều bọc try/catch: trình duyệt ở chế độ ẩn danh có thể ném lỗi ngay ở
 * bước truy cập, và một tùy chọn hiển thị không đáng làm hỏng cả bảng lịch.
 */

const KEY = "tlshost.board.view";

/** Bề rộng cột ngày, tính bằng rem. Bảy nấc, đủ để đi từ chật tới rất thoáng. */
const ZOOM = [3.5, 4.25, 5, 6.5, 8, 9.5, 11] as const;
const DEFAULT_ZOOM = 3; // 6.5rem, đúng giá trị đang dùng trước khi có nút này

const ROW_HEIGHT = { thoang: "2.75rem", gon: "2rem" } as const;
type Density = keyof typeof ROW_HEIGHT;

type View = { zoom: number; density: Density };

const DEFAULT: View = { zoom: DEFAULT_ZOOM, density: "thoang" };

/**
 * localStorage là một kho bên ngoài React, nên nó được đọc bằng
 * useSyncExternalStore chứ không bằng một effect gọi setState.
 *
 * Cách kia — useEffect(() => setView(read()), []) — bị luật
 * react-hooks/set-state-in-effect chặn, và luật đó đúng: nó khiến React vẽ
 * một lần với giá trị mặc định rồi vẽ lại ngay với giá trị đã lưu, và người
 * dùng thấy cột nhảy một nhịp mỗi lần mở trang.
 *
 * getServerSnapshot trả về DEFAULT vì máy chủ không có localStorage. Nhờ đó
 * bản dựng trên máy chủ và bản đầu tiên trên trình duyệt khớp nhau, rồi React
 * mới đổi sang giá trị thật — không có cảnh báo hydrate nào.
 */
let current: View | null = null;
const listeners = new Set<() => void>();

function load(): View {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw) as Partial<View>;
    return {
      zoom:
        typeof v.zoom === "number" && v.zoom >= 0 && v.zoom < ZOOM.length
          ? v.zoom
          : DEFAULT_ZOOM,
      density: v.density === "gon" ? "gon" : "thoang",
    };
  } catch {
    // Cửa sổ ẩn danh có thể ném lỗi ngay ở bước truy cập. Một tùy chọn hiển
    // thị không đáng làm hỏng cả bảng lịch.
    return DEFAULT;
  }
}

// Giá trị được nhớ lại: useSyncExternalStore gọi getSnapshot sau mỗi lần vẽ,
// và trả về một đối tượng mới mỗi lần sẽ thành vòng lặp vô tận.
function snapshot(): View {
  if (current === null) current = load();
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(next: View): void {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Không lưu được thì thôi: tùy chọn vẫn có hiệu lực tới khi rời trang.
  }
  for (const listener of listeners) listener();
}

/** Màu trong chú thích lấy từ chính lớp CSS mà thanh đặt phòng đang dùng. */
const LEGEND = [
  { label: "Đã xác nhận", className: "bg-ink-900" },
  { label: "Khoá đêm", className: "border border-dashed border-ink-400 bg-sand-200" },
] as const;

export function DisplayOptions() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const view = useSyncExternalStore(subscribe, snapshot, () => DEFAULT);
  const box = useRef<HTMLDivElement>(null);

  // Ghi thẳng lên phần tử .board. Đặt trên :root cũng chạy, nhưng biến này chỉ
  // có nghĩa với bảng lịch, và một biến toàn cục chỉ dùng ở một chỗ là thứ sẽ
  // có người sửa nhầm.
  useEffect(() => {
    const board = document.querySelector<HTMLElement>(".board");
    if (!board) return;
    board.style.setProperty("--board-day-col", `${ZOOM[view.zoom]}rem`);
    board.style.setProperty("--board-row-h", ROW_HEIGHT[view.density]);
  }, [view]);

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

  const step = (by: number) =>
    write({
      ...view,
      zoom: Math.min(ZOOM.length - 1, Math.max(0, view.zoom + by)),
    });

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t("Tùy chọn hiển thị")}
        className="grid size-9 place-items-center rounded-full border border-line text-ink-700 transition-colors hover:bg-sand-50"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="16" cy="18" r="2" />
        </svg>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t("Tùy chọn hiển thị")}
          className="absolute right-0 top-full z-30 mt-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-lg"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {t("Tùy chọn hiển thị")}
          </p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[14px] text-ink-800">{t("Thu phóng")}</span>
            <div className="flex overflow-hidden rounded-full border border-line-strong">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={view.zoom === 0}
                aria-label={t("Thu nhỏ")}
                className="grid size-8 place-items-center text-ink-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:text-ink-300"
              >
                <span aria-hidden="true">−</span>
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                disabled={view.zoom === ZOOM.length - 1}
                aria-label={t("Phóng to")}
                className="grid size-8 place-items-center border-l border-line-strong text-ink-700 hover:bg-sand-100 disabled:cursor-not-allowed disabled:text-ink-300"
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[14px] text-ink-800">{t("Mật độ hàng")}</span>
            <div className="flex overflow-hidden rounded-full border border-line-strong">
              {(["thoang", "gon"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => write({ ...view, density: d })}
                  aria-pressed={view.density === d}
                  className={`px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                    view.density === d
                      ? "bg-ink-900 text-sand-100"
                      : "text-ink-600 hover:bg-sand-100"
                  }`}
                >
                  {d === "thoang" ? t("Thoáng") : t("Gọn")}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
              {t("Chú thích")}
            </p>
            {/* Chỉ hai màu, vì bảng này chỉ vẽ hai thứ. Bản thiết kế có năm ô —
                Chờ xử lý, Đã nhận phòng, Đã trả phòng, Vắng mặt — nhưng ứng
                dụng này mới có CONFIRMED và CANCELLED. Bày ra một chú thích cho
                màu không bao giờ xuất hiện thì tệ hơn là không có chú thích. */}
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              {LEGEND.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`size-3 shrink-0 rounded-[3px] ${item.className}`}
                  />
                  <span className="text-[13px] text-ink-700">{t(item.label)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
