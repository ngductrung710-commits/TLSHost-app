"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

/**
 * Một cơ sở và những hàng phòng của nó, thu gọn được.
 *
 * Chỉ phần này là client, không phải cả bảng. BoardGrid gọi dictFor() từ
 * src/lib/locale.ts, mà tệp đó đọc cookie — biến cả bảng thành client sẽ kéo
 * next/headers xuống trình duyệt, đúng lớp lỗi mà scripts/check-client.mjs
 * canh. Nên trạng thái thu gọn ở đây, còn hàng phòng vẫn do máy chủ dựng và
 * đi vào qua children.
 *
 * Bọc bằng `display: contents`: bảng này là một CSS grid và mọi hàng phải là
 * con trực tiếp của nó. Một thẻ div bình thường ở đây sẽ tách nhóm ra thành
 * một ô duy nhất và phá vỡ mọi cột.
 */
export function RoomGroup({
  propertyId,
  name,
  count,
  days,
  addLabel,
  children,
}: {
  propertyId: string;
  name: string;
  count: number;
  /** Số cột ngày, để hàng tiêu đề trải hết bề ngang. */
  days: number;
  /** Nhãn "Thêm phòng", dịch sẵn ở phía máy chủ. */
  addLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="contents">
      <div className="board__sticky flex items-center gap-1.5 border-b border-r border-line bg-canvas-alt/60 px-2 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={name}
          className="grid size-6 shrink-0 place-items-center rounded-md text-ink-500 transition-colors hover:bg-sand-200 hover:text-ink-900"
        >
          {/* Mũi tên xoay chứ không đổi ký tự: đổi giữa ‹ và ⌄ làm nó nhảy một
              nhịp vì hai ký tự rộng khác nhau. */}
          <svg
            viewBox="0 0 16 16"
            className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>

        <Link
          href={`/cho-nghi/${propertyId}`}
          className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-700 hover:text-ink-900"
        >
          <span className="truncate">{name}</span>
          <span className="shrink-0 rounded-full bg-sand-200 px-1.5 text-[10px] font-semibold text-ink-600 tnum">
            {count}
          </span>
        </Link>
      </div>

      <div
        className="border-b border-line bg-canvas-alt/60"
        style={{ gridColumn: `2 / span ${days}` }}
      />

      {open ? children : null}

      {/* Lối thêm phòng nằm cuối chính nhóm nó thuộc về, và chỉ hiện khi nhóm
          đang mở — một nút "thêm phòng" dưới một nhóm đã thu gọn thì không rõ
          nó thêm vào đâu.

          Trước commit này nút không có, vì chưa có đường nào thêm phòng vào
          một cơ sở đã tạo: nó sẽ là một liên kết dẫn tới hư không. Giờ tab
          Phòng làm được việc đó, nên liên kết này có chỗ để tới. */}
      {open ? (
        <>
          <div className="board__sticky border-b border-r border-line px-2 py-1.5">
            <Link
              href={`/cho-nghi/${propertyId}?tab=phong`}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
            >
              <span aria-hidden="true" className="text-[15px] leading-none">
                +
              </span>
              {addLabel}
            </Link>
          </div>
          <div
            className="border-b border-line"
            style={{ gridColumn: `2 / span ${days}` }}
          />
        </>
      ) : null}
    </div>
  );
}
