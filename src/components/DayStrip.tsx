"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useT } from "@/components/I18nProvider";
import { useBoardMode } from "@/components/BoardMode";
import { openNewBooking } from "@/components/NewBookingPanel";
import { fill } from "@/lib/i18n";

/**
 * Một hàng ô ngày trống của một phòng, có thể kéo để chọn nhiều đêm.
 *
 * Thay cho việc mỗi ô là một cái link riêng: một lượt đặt luôn nằm gọn trong
 * một phòng, nên cả cú kéo cũng gói gọn trong một hàng — và một component lo
 * cho đúng một hàng thì không phải điều phối con trỏ băng qua nhiều phòng.
 *
 * Cái link vẫn còn dưới mỗi ô, vì hai lý do không thừa nhau: bàn phím cần một
 * đích Enter đi tới được, và Ctrl+bấm phải mở /lich/moi ở tab mới như mọi link
 * thật. Cú kéo và cú bấm-trái-thường thì được chặn lại để mở ngăn kéo ngay
 * trên lịch.
 *
 * Con trỏ là hình ô (dấu +) — đúng cái CSS gọi là `cell`, và cũng là con trỏ
 * bản thiết kế dùng: nó nói "bấm hoặc kéo vào lưới này" rõ hơn mũi tên.
 */

type DayStripProps = {
  roomId: string;
  roomName: string;
  /** Các ngày trong khung, dạng YYYY-MM-DD. */
  days: string[];
  /** Vị trí cột của hôm nay, hoặc -1 nếu hôm nay không nằm trong khung. */
  todayIndex: number;
  /** Ngày nào là cuối tuần, cùng thứ tự với days. */
  weekend: boolean[];
};

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function DayStrip({
  roomId,
  roomName,
  days,
  todayIndex,
  weekend,
}: DayStripProps) {
  const t = useT();
  const mode = useBoardMode();
  const router = useRouter();

  // Dải đang chọn, theo chỉ số cột: [neo, đang-tới]. Null khi không kéo.
  const [sel, setSel] = useState<{ anchor: number; head: number } | null>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  // Sau một cú kéo thật, trình duyệt vẫn bắn một sự kiện click lên ô thả tay.
  // Cờ này nuốt đúng cú click đó để cú kéo không mở thêm một ngăn kéo một đêm.
  const suppressClick = useRef(false);

  /** Mở đúng thứ ứng với chế độ, cho khoảng [from, to). */
  function act(from: string, to: string) {
    if (mode === "chan") {
      router.push(`/lich/khoa?room=${roomId}&from=${from}&to=${to}`);
    } else {
      openNewBooking({ roomId, from, to });
    }
  }

  /** Chỉ số cột dưới một toạ độ màn hình, hoặc null nếu ra ngoài dải này. */
  function indexAt(x: number, y: number): number | null {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-day-index]");
    if (!el) return null;
    const owner = el.closest<HTMLElement>("[data-strip]");
    // Kéo lê sang hàng phòng khác thì không tính: cái ô dưới con trỏ thuộc
    // một strip khác, và một lượt đặt không trải trên hai phòng.
    if (!owner || owner.dataset.strip !== roomId) return null;
    const i = Number(el.dataset.dayIndex);
    return Number.isInteger(i) ? i : null;
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const i = indexAt(e.clientX, e.clientY);
    if (i === null) return;
    dragging.current = true;
    moved.current = false;
    setSel({ anchor: i, head: i });
    // Giữ con trỏ để vẫn nhận move khi lê nhanh ra ngoài một ô.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const i = indexAt(e.clientX, e.clientY);
    if (i === null) return;
    setSel((s) => {
      if (!s || s.head === i) return s;
      moved.current = true;
      return { ...s, head: i };
    });
  }

  function endDrag(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

    const s = sel;
    setSel(null);
    if (!s || !moved.current) return; // cú bấm đơn để onClick của ô lo

    suppressClick.current = true;
    const lo = Math.min(s.anchor, s.head);
    const hi = Math.max(s.anchor, s.head);
    act(days[lo], addDays(days[hi], 1));
  }

  function onCellClick(e: React.MouseEvent, i: number) {
    if (suppressClick.current) {
      // Cú click "đuôi" của một lần kéo. Nuốt nó, và trả cờ về.
      suppressClick.current = false;
      e.preventDefault();
      return;
    }
    // Bấm-trái-thường mở ngay trên lịch; các kiểu bấm khác để link tự chạy
    // (mở tab mới, hoặc dùng được khi JavaScript chưa tải xong).
    if (e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    act(days[i], addDays(days[i], 1));
  }

  const lo = sel ? Math.min(sel.anchor, sel.head) : 0;
  const hi = sel ? Math.max(sel.anchor, sel.head) : 0;
  // Hiện ngay từ ô đầu tiên lúc bấm xuống, như bản thiết kế — với cú bấm đơn
  // nó chỉ chớp một ô rồi ngăn kéo mở ra. `moved` là ref nên không đọc ở đây;
  // nó chỉ phân biệt kéo với bấm trong lúc thả tay.
  const showBox = sel !== null;

  return (
    <div
      data-strip={roomId}
      className="relative grid h-full cursor-cell select-none touch-none"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {days.map((day, i) => {
        const href =
          mode === "chan"
            ? `/lich/khoa?room=${roomId}&from=${day}`
            : `/lich/moi?room=${roomId}&from=${day}`;
        const label =
          mode === "chan"
            ? fill(t("Chặn đêm — {phong}, {ngay}"), { phong: roomName, ngay: day })
            : fill(t("Thêm đặt phòng — {phong}, {ngay}"), {
                phong: roomName,
                ngay: day,
              });
        return (
          <Link
            key={day}
            href={href}
            data-day-index={i}
            aria-label={label}
            draggable={false}
            onClick={(e) => onCellClick(e, i)}
            className={[
              // cursor-cell lặp lại ở đây dù strip đã có: thẻ <a> mặc định là
              // con trỏ pointer, và nó thắng cái đặt trên ô cha.
              "cursor-cell",
              // Chiều cao đọc từ biến chứ không cố định: nút "Mật độ hàng" đổi
              // đúng biến này, và một lớp Tailwind cứng sẽ không nghe.
              "h-[var(--board-row-h,2.75rem)] border-r border-line/60 transition-colors last:border-r-0 hover:bg-clay-50",
              i === todayIndex
                ? "bg-clay-50/60"
                : weekend[i]
                  ? "bg-sand-50/60"
                  : "",
            ].join(" ")}
          />
        );
      })}

      {/* Ô chọn: viền đứt bo góc, nền nhạt — vẽ đè lên lưới trong lúc kéo. Chỉ
          trang trí, con số đêm nằm trong ngăn kéo sắp mở, nên aria-hidden.
          Màu teal #008489 đặt thẳng chứ không mượn token: đây là màu của bản
          thiết kế phuchost, không nằm trong bảng màu clay/sand của app. */}
      {showBox ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-1 z-10 rounded-lg border-2 border-dashed"
          style={{
            left: `${(lo / days.length) * 100}%`,
            width: `${((hi - lo + 1) / days.length) * 100}%`,
            borderColor: "#008489",
            backgroundColor: "rgba(0, 132, 137, 0.1)",
          }}
        />
      ) : null}
    </div>
  );
}
