"use client";

import { useSyncExternalStore } from "react";

import { useT } from "@/components/I18nProvider";

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

export function useBoardMode(): BoardMode {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

function useMode(): BoardMode {
  return useBoardMode();
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

// Một ô ngày trống từng là component riêng ở đây; giờ cả hàng ô do DayStrip
// lo, để một cú kéo chọn được nhiều đêm. Chế độ (useBoardMode) và openNewBooking
// vẫn là hai thứ DayStrip đọc từ chỗ này.
