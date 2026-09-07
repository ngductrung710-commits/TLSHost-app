"use client";

import { useState } from "react";

import { useT } from "@/components/I18nProvider";

/**
 * Tên phòng trong cột trái của bảng lịch, đổi tại chỗ.
 *
 * Bấm nút bút chì thì cái tên biến thành một ô nhập ngay đúng chỗ nó đang
 * đứng — không hộp thoại, không rời trang. Đổi tên một phòng là việc người ta
 * làm trong lúc đang nhìn lịch và nhận ra "Phòng 3" thật ra là "Phòng Vườn",
 * và bắt họ đi sang trang khác rồi quay lại là bắt họ mất chỗ đang xem.
 *
 * Nút chỉ hiện khi rê chuột vào hàng hoặc khi nó được focus bằng bàn phím.
 * Luôn hiện thì mỗi hàng có thêm một vật thể để mắt phải bỏ qua, mà bảng này
 * đã có mười mấy hàng.
 */
export function RoomNameCell({
  roomId,
  name,
  action,
  canEdit,
}: {
  roomId: string;
  name: string;
  action: (formData: FormData) => Promise<void>;
  /** Cộng tác viên và người dọn phòng chỉ đọc. */
  canEdit: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);

  if (!canEdit) {
    return <p className="truncate text-[13px] font-semibold text-ink-900">{name}</p>;
  }

  if (editing) {
    return (
      <form
        action={action}
        onSubmit={() => setEditing(false)}
        className="flex items-center gap-1"
      >
        <input type="hidden" name="roomId" value={roomId} />
        <input
          name="name"
          defaultValue={name}
          autoFocus
          maxLength={120}
          aria-label={t("Tên phòng")}
          // Esc bỏ dở và trả lại tên cũ. Không có nút Hủy vì hàng chỉ rộng
          // chừng này, và Esc là thứ người ta thử trước tiên.
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(false);
          }}
          className="min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-2 py-1 text-[13px] font-semibold text-ink-900 outline-none focus-visible:border-ink-900"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg px-1.5 py-1 text-[12px] font-semibold text-ink-700 hover:bg-sand-100"
        >
          {t("Lưu")}
        </button>
      </form>
    );
  }

  return (
    <div className="group/name flex items-center gap-1">
      <p className="truncate text-[13px] font-semibold text-ink-900">{name}</p>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={t("Sửa tên phòng")}
        className="shrink-0 rounded-md p-1 text-ink-400 opacity-0 transition-opacity hover:bg-sand-100 hover:text-ink-900 focus-visible:opacity-100 group-hover/name:opacity-100"
      >
        <svg
          viewBox="0 0 16 16"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M11.3 2.7a1.7 1.7 0 0 1 2.4 2.4L5.5 13.3l-3.2.8.8-3.2z" />
        </svg>
      </button>
    </div>
  );
}
