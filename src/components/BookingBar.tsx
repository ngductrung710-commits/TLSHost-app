"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useT } from "@/components/I18nProvider";
import { openBookingDetail } from "@/components/BookingDetailDrawer";
import type { BookingState } from "@/app/(app)/lich/actions";
import {
  NEXT_ACTIONS,
  STATUS_BAR,
  STATUS_LABEL,
  STATUS_PILL,
  bookingCode,
  type BookingStatusName,
} from "@/lib/bookingStatus";
import { fill, type Locale } from "@/lib/i18n";

/**
 * Một lượt đặt trên bảng lịch: thanh màu theo trạng thái, và một thẻ hiện ra
 * khi rê chuột — đủ thông tin để quyết mà không phải mở trang riêng, cùng vài
 * nút làm ngay việc thường làm nhất.
 *
 * Thẻ đi qua portal lên <body> vì bảng lịch cuộn ngang và có cột dán cạnh
 * (sticky) tạo ngữ cảnh xếp lớp riêng; một thẻ nằm trong hàng sẽ bị cắt ở mép
 * vùng cuộn. Cùng lý do đã đưa ngăn kéo thêm phòng ra portal.
 */

export type BookingBarData = {
  id: string;
  label: string;
  status: string | null;
  ref: number | null;
  source: string | null;
  checkIn: string | null;
  checkOut: string | null;
  nights: number;
  totalCents: number | null;
  depositCents: number | null;
  offset: number;
  span: number;
  openStart: boolean;
  openEnd: boolean;
};

function normalizeStatus(s: string | null): BookingStatusName {
  const known: BookingStatusName[] = [
    "PENDING",
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
    "NO_SHOW",
    "CANCELLED",
  ];
  return known.includes(s as BookingStatusName)
    ? (s as BookingStatusName)
    : "CONFIRMED";
}

/** Quả địa cầu cho đơn trực tiếp; cùng biểu tượng đó cho mọi nguồn còn lại,
    tên nguồn đã nằm trong thẻ. */
function Globe({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </svg>
  );
}

type BookingAction = (
  prev: BookingState,
  fd: FormData,
) => Promise<BookingState>;

export function BookingBar({
  data,
  days,
  roomName,
  propertyName,
  currency,
  locale,
  statusAction,
  payAction,
}: {
  data: BookingBarData;
  /** Số cột trong hàng, để đặt thanh theo phần trăm. */
  days: number;
  roomName: string;
  propertyName: string;
  /** Ký hiệu tiền tệ, đã đổi sẵn phía máy chủ. */
  currency: string;
  locale: Locale;
  // Server action truyền xuống từ trang, không import thẳng: một client
  // component import từ tệp "use server" sẽ kéo theo cả cây server-only, và
  // check:client chặn đúng điều đó.
  statusAction: BookingAction;
  payAction: BookingAction;
}) {
  const t = useT();
  const status = normalizeStatus(data.status);
  const bar = STATUS_BAR[status];
  const pill = STATUS_PILL[status];
  const code = bookingCode(propertyName, data.ref);

  // "Thứ 2, 7 thg 9" — đúng cách bản thiết kế viết ngày. Đặt trong component
  // vì "Chủ nhật" phải đi qua t(); các mảnh còn lại là template nên dịch theo
  // locale ngay tại đây, tiếng Anh ra "Mon, 9/7".
  const dayLabel = (iso: string): string => {
    const d = new Date(`${iso}T00:00:00Z`);
    const day = d.getUTCDate();
    const month = d.getUTCMonth() + 1;
    const dow = d.getUTCDay();
    if (locale === "en") {
      const wk = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow];
      return `${wk}, ${month}/${day}`;
    }
    const wk = dow === 0 ? t("Chủ nhật") : `Thứ ${dow + 1}`;
    return `${wk}, ${day} thg ${month}`;
  };

  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN");
  const outstanding =
    data.totalCents === null
      ? null
      : Math.max(0, data.totalCents - (data.depositCents ?? 0));
  const unpaid = outstanding !== null && outstanding > 0;

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // Khi mở form ghi nhận thanh toán, cùng số tiền đang gõ. Số dạng chuỗi để ô
  // nhập cho phép xoá trắng; đọc lại bằng Number lúc gửi.
  const [paying, setPaying] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const barRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const CARD_W = 340;

  function place() {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Canh mép trái thẻ với mép trái thanh, nhưng không tràn ra khỏi màn hình.
    const left = Math.min(
      Math.max(8, r.left),
      window.innerWidth - CARD_W - 8,
    );
    // Mặc định hiện dưới thanh; nếu gần đáy quá thì lật lên trên.
    const below = r.bottom + 8;
    const top = below + 260 > window.innerHeight ? r.top - 8 - 260 : below;
    setPos({ top: Math.max(8, top), left });
  }

  function close() {
    setOpen(false);
    setPaying(false);
  }
  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    place();
    setOpen(true);
  }
  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Đang gõ số tiền thì đừng tự đóng khi chuột lỡ rời ra: form còn dở, đóng
    // mất là mất luôn con số vừa gõ. Rời ra lúc chưa mở form thì đóng như cũ.
    if (paying) return;
    // Ân hạn đủ rộng để đi từ thanh xuống thẻ (có một khoảng hở giữa hai cái):
    // đi chậm qua khoảng hở mà thẻ đã đóng thì hụt tay. Đóng ngay khi bấm ra
    // ngoài vẫn có, nên chờ lâu hơn một chút không giữ thẻ lại quá mức.
    closeTimer.current = setTimeout(() => close(), 300);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onScroll = () => close();
    // Bấm ra ngoài cả thanh lẫn thẻ thì đóng. Cần cho cảm ứng, nơi không có
    // "rời chuột": chạm thanh mở thẻ, chạm chỗ khác đóng lại.
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (barRef.current?.contains(target)) return;
      if (cardRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown, true);
    // Cuộn thì đóng: thẻ neo theo toạ độ màn hình, cuộn một cái là nó lệch khỏi
    // thanh. Đóng gọn hơn là chạy theo.
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  async function run(
    action: (prev: { error: string | null }, fd: FormData) => Promise<{ error: string | null }>,
    fields: Record<string, string>,
  ) {
    setBusy(true);
    const fd = new FormData();
    fd.set("id", data.id);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    const result = await action({ error: null }, fd);
    setBusy(false);
    // revalidatePath trong action đã vẽ lại bảng từ máy chủ; thanh này mang
    // trạng thái mới. Đóng thẻ để người dùng thấy kết quả trên lịch.
    if (!result.error) close();
  }

  const inner = [
    "flex h-full w-full items-center gap-1.5 overflow-hidden rounded-lg border px-2 text-[12px] font-semibold shadow-sm transition-[filter] hover:brightness-105",
    data.openStart ? "stay--open-start" : "",
    data.openEnd ? "stay--open-end" : "",
  ].join(" ");

  const transitions = NEXT_ACTIONS[status];

  return (
    <div
      className="absolute inset-y-1 px-0.5"
      style={{
        left: `${(data.offset / days) * 100}%`,
        width: `${(data.span / days) * 100}%`,
      }}
    >
      <button
        ref={barRef}
        type="button"
        onClick={show}
        onPointerEnter={show}
        onPointerLeave={scheduleClose}
        onFocus={show}
        onBlur={scheduleClose}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={inner}
        style={{ backgroundColor: bar.bg, color: bar.fg, borderColor: bar.border }}
        title={`${data.label} · ${fill(t("{n} đêm"), { n: data.nights })}`}
      >
        <Globe className="size-3.5 shrink-0 opacity-90" />
        <span className="truncate">{data.label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {unpaid ? (
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full"
              style={{ backgroundColor: "#F43F5E" }}
            />
          ) : null}
          <span className="tnum opacity-90">{data.nights}</span>
        </span>
      </button>

      {open && pos
        ? createPortal(
            <div
              ref={cardRef}
              role="dialog"
              aria-label={data.label}
              onPointerEnter={() => {
                if (closeTimer.current) clearTimeout(closeTimer.current);
              }}
              onPointerLeave={scheduleClose}
              className="fixed z-50 rounded-2xl border border-line bg-surface p-4 shadow-xl"
              style={{ top: pos.top, left: pos.left, width: CARD_W }}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-10 shrink-0 place-items-center rounded-full border border-line text-ink-600"
                >
                  <Globe className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink-900">
                    {data.label}
                  </p>
                  {code ? (
                    <p className="tnum text-[12px] text-ink-500">{code}</p>
                  ) : null}
                </div>
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: pill.bg, color: pill.fg }}
                >
                  {t(STATUS_LABEL[status])}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-[13px] text-ink-700">
                {data.checkIn && data.checkOut ? (
                  <div className="flex items-center gap-2">
                    <IconCal className="size-4 shrink-0 text-ink-400" />
                    <span className="whitespace-nowrap">{dayLabel(data.checkIn)}</span>
                    <span className="text-ink-400">→</span>
                    <span className="whitespace-nowrap">{dayLabel(data.checkOut)}</span>
                    <span className="tnum ml-auto shrink-0 text-ink-500">
                      {fill(t("{n} đêm"), { n: data.nights })}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <IconBed className="size-4 shrink-0 text-ink-400" />
                  <span className="truncate">
                    {propertyName} · {roomName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <IconCard className="size-4 shrink-0 text-ink-400" />
                  <span className="text-ink-500">{t("Còn lại")}</span>
                  <span
                    className="tnum ml-auto font-semibold"
                    style={{ color: unpaid ? "#E11D48" : undefined }}
                  >
                    {outstanding === null
                      ? "—"
                      : `${money.format(outstanding)} ${currency}`}
                  </span>
                </div>
              </div>

              {paying ? (
                /* Form ghi nhận thanh toán: nhập số tiền vừa thu, mặc định là
                   phần còn nợ. Ba nút nhanh chọn theo phần trăm phần còn nợ. */
                <div className="mt-4 border-t border-line pt-3">
                  <label
                    htmlFor={`pay-${data.id}`}
                    className="block text-[12px] font-semibold text-ink-700"
                  >
                    {t("Số tiền")}
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      id={`pay-${data.id}`}
                      inputMode="numeric"
                      value={payAmount}
                      onChange={(e) =>
                        setPayAmount(e.target.value.replace(/\D/g, ""))
                      }
                      className="tnum block h-9 w-full rounded-lg border border-line-strong bg-white pl-3 pr-12 text-[14px] text-ink-900 outline-none focus-visible:border-ink-900"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-medium text-ink-400"
                    >
                      {currency}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { label: "25%", part: 0.25 },
                        { label: "50%", part: 0.5 },
                        { label: t("Còn lại"), part: 1 },
                      ] as const
                    ).map((choice) => (
                      <button
                        key={choice.label}
                        type="button"
                        onClick={() =>
                          setPayAmount(
                            String(Math.round((outstanding ?? 0) * choice.part)),
                          )
                        }
                        className="h-8 rounded-lg bg-sand-100 px-2 text-[12px] font-semibold text-ink-700 hover:bg-sand-200"
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPaying(false)}
                      className="inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold text-ink-600 hover:text-ink-900"
                    >
                      {t("Hủy")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(payAction, { amount: payAmount })}
                      className="inline-flex h-8 items-center rounded-full bg-ink-900 px-4 text-[12px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-50"
                    >
                      {t("Lưu")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  {transitions.map((tr) => (
                    <button
                      key={tr.to}
                      type="button"
                      disabled={busy}
                      onClick={() => run(statusAction, { status: tr.to })}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink-800 hover:bg-sand-50 disabled:opacity-50"
                    >
                      {t(tr.label)}
                    </button>
                  ))}
                  {unpaid ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPayAmount(String(outstanding ?? 0));
                        setPaying(true);
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[12px] font-semibold text-ink-800 hover:bg-sand-50 disabled:opacity-50"
                    >
                      <IconCard className="size-3.5" />
                      {t("Ghi nhận thanh toán")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      openBookingDetail(data.id);
                    }}
                    className="ml-auto inline-flex h-8 items-center gap-1 rounded-full bg-ink-900 px-3 text-[12px] font-semibold text-sand-100 hover:bg-ink-800"
                  >
                    {t("Mở")}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function IconCal({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  );
}
function IconBed({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 18v-9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9" />
      <path d="M3 14h18M7 11h4M3 18v2M21 18v2" />
    </svg>
  );
}
function IconCard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
