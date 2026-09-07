"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { useT } from "@/components/I18nProvider";
import { openNewBooking } from "@/components/NewBookingPanel";
import { fill } from "@/lib/i18n";

/**
 * Chế độ của bảng lịch: bấm vào một ô trống thì tạo đặt phòng, hay chặn đêm.
 *
 * Trước đây đây là hai cái nút riêng trên thanh công cụ — "Khóa đêm" mở một
 * trang trống rồi bắt chọn lại phòng và ngày mà mình vừa nhìn thấy trên lịch.
 * Gộp thành một cặp chọn thì cái ô mình bấm đã nói sẵn phòng nào, đêm nào.
 *
 * Chế độ KHÔNG được lưu lại. Bề rộng cột thì lưu (xem DisplayOptions), vì lần
 * sau mở lên thấy cột rộng đúng ý là dễ chịu; còn mở lên mà lịch vẫn đang ở
 * chế độ "Chặn" từ hôm qua thì cú bấm đầu tiên trong ngày sẽ chặn một đêm mà
 * mình tưởng là đang đặt phòng. Mặc định luôn là "Đặt phòng", mỗi lần tải lại.
 */

export type BoardMode = "dat" | "chan";

let current: BoardMode = "dat";
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): BoardMode {
  return current;
}

function set(next: BoardMode): void {
  current = next;
  for (const listener of listeners) listener();
}

/** Máy chủ không có chế độ nào cả; nó dựng ra bản "Đặt phòng" như mọi lần. */
function serverSnapshot(): BoardMode {
  return "dat";
}

function useMode(): BoardMode {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** Cặp nút trên thanh công cụ. */
export function BoardModeToggle() {
  const t = useT();
  const mode = useMode();

  const options = [
    { id: "dat", label: t("Đặt phòng"), hint: t("Bấm vào ô trống để tạo đặt phòng.") },
    { id: "chan", label: t("Chặn"), hint: t("Bấm vào ô trống để chặn đêm cho bảo trì.") },
  ] as const;

  return (
    <div
      role="group"
      aria-label={t("Bấm vào ô trống thì làm gì")}
      className="flex h-9 items-center overflow-hidden rounded-full border border-line text-[13px] font-semibold"
    >
      {options.map((option, i) => (
        <button
          key={option.id}
          type="button"
          onClick={() => set(option.id)}
          // aria-pressed chứ không phải aria-selected: đây là hai cái nút bật
          // tắt lẫn nhau, không phải hai cái tab mở ra hai vùng nội dung.
          aria-pressed={mode === option.id}
          title={option.hint}
          className={[
            "h-full px-3.5 transition-colors",
            i > 0 ? "border-l border-line" : "",
            mode === option.id
              ? "bg-ink-900 text-sand-100"
              : "text-ink-500 hover:bg-sand-50 hover:text-ink-900",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Một ô ngày trống trên bảng.
 *
 * Nó là client component chỉ vì một lý do: địa chỉ của nó đổi theo chế độ ở
 * trên. Mọi thứ còn lại — màu cuối tuần, viền, đánh dấu hôm nay — vẫn do máy
 * chủ tính rồi truyền xuống qua className, nên phần chạy trên trình duyệt chỉ
 * còn đúng một câu điều kiện.
 */
export function DayCell({
  roomId,
  roomName,
  date,
  className,
}: {
  roomId: string;
  roomName: string;
  /** Ngày dạng YYYY-MM-DD. */
  date: string;
  className: string;
}) {
  const t = useT();
  const mode = useMode();

  const href =
    mode === "chan"
      ? `/lich/khoa?room=${roomId}&from=${date}`
      : `/lich/moi?room=${roomId}&from=${date}`;

  // Nhãn phải nói đúng việc sắp xảy ra. Một ô đọc lên là "Thêm đặt phòng" mà
  // bấm vào lại ra trang khóa đêm là thứ chỉ người dùng trình đọc màn hình
  // gặp phải, và họ không có cái nút sẫm màu ở trên để đối chiếu.
  const label =
    mode === "chan"
      ? fill(t("Chặn đêm — {phong}, {ngay}"), { phong: roomName, ngay: date })
      : fill(t("Thêm đặt phòng — {phong}, {ngay}"), { phong: roomName, ngay: date });

  return (
    <Link
      href={href}
      aria-label={label}
      className={className}
      onClick={(e) => {
        // Chế độ "Chặn" vẫn đi tới trang khóa đêm như cũ.
        if (mode === "chan") return;

        // Giữ nguyên href và chỉ chặn cú bấm thường: bấm giữa chuột, Ctrl+bấm
        // hay "mở trong tab mới" vẫn phải ra được trang /lich/moi, và nếu
        // JavaScript chưa tải xong thì cái link vẫn là một cái link.
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (e.button !== 0) return;

        e.preventDefault();
        openNewBooking({ roomId, from: date });
      }}
    />
  );
}
