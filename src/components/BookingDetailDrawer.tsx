"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { useT } from "@/components/I18nProvider";
import type { BookingDetail, BookingState } from "@/app/(app)/lich/actions";
import {
  NEXT_ACTIONS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABEL,
  STAY_PHASE_LABEL,
  STATUS_LABEL,
  STATUS_PILL,
  bookingCode,
  stayPhase,
  type BookingStatusName,
  type PaymentMethodName,
} from "@/lib/bookingStatus";
import { fill, type Locale } from "@/lib/i18n";

/**
 * Chi tiết một lượt đặt, mở thành drawer bên phải ngay trên lịch — đúng như
 * bản thiết kế. Một chỗ gộp cả ba việc: đổi trạng thái, sửa thông tin lưu trú,
 * và ghi nhận thanh toán, để chủ nhà không phải rời khỏi cái lịch đang nhìn.
 *
 * Dữ liệu tải khi mở (loadDetail), không truyền sẵn từ bảng: bảng chỉ biết
 * những gì nó cần để vẽ thanh, còn drawer cần cả ghi chú, khách, lịch sử thu.
 */

type Action = (prev: BookingState, fd: FormData) => Promise<BookingState>;
type VoidAction = (fd: FormData) => Promise<void>;

/* -- kho mở drawer, giống openNewBooking ------------------------------------ */
let pendingId: string | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function snapshot(): string | null {
  return pendingId;
}
function serverSnapshot(): string | null {
  return null;
}
/** Gọi từ thẻ hover (nút "Mở"). */
export function openBookingDetail(id: string): void {
  pendingId = id;
  for (const listener of listeners) listener();
}
function clearPending(): void {
  pendingId = null;
  for (const listener of listeners) listener();
}

function normStatus(s: string): BookingStatusName {
  const known: BookingStatusName[] = [
    "PENDING",
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
    "NO_SHOW",
    "CANCELLED",
  ];
  return known.includes(s as BookingStatusName) ? (s as BookingStatusName) : "CONFIRMED";
}

export function BookingDetailDrawer({
  loadDetail,
  updateAction,
  statusAction,
  payAction,
  deletePaymentAction,
  cancelAction,
  currency,
  locale,
  today,
}: {
  loadDetail: (id: string) => Promise<BookingDetail | null>;
  updateAction: Action;
  statusAction: Action;
  payAction: Action;
  deletePaymentAction: VoidAction;
  cancelAction: VoidAction;
  currency: string;
  locale: Locale;
  /** Hôm nay theo múi giờ tổ chức, để tính giai đoạn lưu trú. */
  today: string;
}) {
  const t = useT();
  const requestedId = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Ô sửa được, khởi tạo lại mỗi lần nạp một đơn khác.
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [roomId, setRoomId] = useState("");
  const [source, setSource] = useState("DIRECT");
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [infants, setInfants] = useState("0");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");

  // Ô ghi nhận thanh toán.
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethodName>("CASH");

  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN");

  function fillFrom(d: BookingDetail) {
    setCheckIn(d.checkIn);
    setCheckOut(d.checkOut);
    setRoomId(d.roomId);
    setSource(d.source);
    setAdults(String(d.adults));
    setChildren(String(d.children));
    setInfants(String(d.infants));
    setDiscount(d.discountCents ? String(d.discountCents) : "");
    setNotes(d.notes);
  }

  // Một đơn vừa được yêu cầu mở: tải chi tiết rồi bày ra. Đặt state trong
  // nhánh render (không phải effect) là để mở tức thì; việc tải là bất đồng bộ
  // nên nó chạy trong effect bên dưới.
  const [activeId, setActiveId] = useState<string | null>(null);
  if (requestedId && requestedId !== activeId) {
    setActiveId(requestedId);
    clearPending();
    setOpen(true);
    setDetail(null);
    setLoading(true);
    setError(null);
    setNotice(null);
  }

  useEffect(() => {
    if (!activeId || !open) return;
    let alive = true;
    loadDetail(activeId)
      .then((d) => {
        if (!alive) return;
        setLoading(false);
        if (!d) {
          setError(t("Không tìm thấy đặt phòng này."));
          return;
        }
        setDetail(d);
        fillFrom(d);
      })
      .catch(() => {
        if (alive) {
          setLoading(false);
          setError(t("Không tải được đặt phòng. Thử lại."));
        }
      });
    return () => {
      alive = false;
    };
    // fillFrom/t ổn định trong phạm vi một lần mở; chỉ cần chạy lại khi đổi đơn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setActiveId(null);
    setDetail(null);
    setError(null);
    setNotice(null);
  }

  async function reload() {
    if (!activeId) return;
    const d = await loadDetail(activeId);
    if (d) {
      setDetail(d);
      fillFrom(d);
    }
  }

  const status = detail ? normStatus(detail.status) : "CONFIRMED";
  const pill = STATUS_PILL[status];
  const phase = detail
    ? stayPhase(detail.checkIn, detail.checkOut, today, detail.status)
    : null;
  const code = detail ? bookingCode(detail.propertyName, detail.ref) : null;

  const total = detail?.totalCents ?? null;
  const discountNum = Number(discount) || 0;
  const payable = total === null ? null : Math.max(0, total - discountNum);
  const paid = detail?.depositCents ?? 0;
  const outstanding = payable === null ? null : Math.max(0, payable - paid);

  const transitions = detail ? NEXT_ACTIONS[status] : [];

  async function runStatus(to: string) {
    if (!detail) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", detail.id);
    fd.set("status", to);
    const r = await statusAction({ error: null }, fd);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setError(null);
    setNotice(t("Đã cập nhật trạng thái."));
    await reload();
  }

  async function runCancel() {
    if (!detail) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", detail.id);
    await cancelAction(fd);
    setBusy(false);
    setNotice(t("Đã cập nhật trạng thái."));
    await reload();
  }

  async function runSave() {
    if (!detail) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", detail.id);
    fd.set("roomId", roomId);
    fd.set("guestName", detail.guestName);
    fd.set("guestEmail", detail.guestEmail);
    fd.set("guestPhone", detail.guestPhone);
    fd.set("checkIn", checkIn);
    fd.set("checkOut", checkOut);
    fd.set("guests", String((Number(adults) || 0) + (Number(children) || 0)));
    fd.set("adults", String(Number(adults) || 0));
    fd.set("children", String(Number(children) || 0));
    fd.set("infants", String(Number(infants) || 0));
    fd.set("discountCents", String(discountNum));
    if (total !== null) fd.set("totalCents", String(total));
    fd.set("source", source);
    fd.set("notes", notes.trim());
    const r = await updateAction({ error: null }, fd);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setError(null);
    setNotice(t("Đã lưu thay đổi."));
    await reload();
  }

  async function runPay() {
    if (!detail) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("id", detail.id);
    fd.set("amount", payAmount);
    fd.set("method", payMethod);
    const r = await payAction({ error: null }, fd);
    setBusy(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setError(null);
    setPayAmount("");
    await reload();
  }

  async function runDeletePayment(paymentId: string) {
    setBusy(true);
    const fd = new FormData();
    fd.set("id", paymentId);
    await deletePaymentAction(fd);
    setBusy(false);
    await reload();
  }

  const input =
    "mt-1.5 block min-h-10 w-full rounded-xl border border-line-strong bg-white px-3 text-[14px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";
  const label = "block text-[13px] font-medium text-ink-700";
  const sectionHead =
    "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500";

  const roomGroups: { name: string; rooms: BookingDetail["rooms"] }[] = [];
  for (const r of detail?.rooms ?? []) {
    const last = roomGroups[roomGroups.length - 1];
    if (last && last.name === r.propertyName) last.rooms.push(r);
    else roomGroups.push({ name: r.propertyName, rooms: [r] });
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={t("Đóng")}
        onClick={close}
        className="absolute inset-0 bg-ink-950/30"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={detail?.guestName ?? t("Chi tiết đặt phòng")}
        className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl"
      >
        {/* Đầu drawer */}
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className={sectionHead}>
              {code ? fill(t("ĐƠN {ma}"), { ma: code }) : t("Đặt phòng")}
            </p>
            <h2 className="mt-0.5 truncate text-[1.125rem] font-semibold text-ink-900">
              {loading ? t("Đang tải…") : detail?.guestName ?? "—"}
            </h2>
            {detail ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ backgroundColor: pill.bg, color: pill.fg }}
                >
                  {t(STATUS_LABEL[status])}
                </span>
                {phase ? (
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-600">
                    {t(STAY_PHASE_LABEL[phase])}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("Đóng")}
            className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-sand-100 hover:text-ink-900"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {error ? (
            <p role="alert" className="mb-4 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] leading-relaxed text-danger">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mb-4 rounded-xl border border-brand/25 bg-clay-50 px-4 py-3 text-[14px] leading-relaxed text-ink-700">
              {notice}
            </p>
          ) : null}

          {detail && detail.editable ? (
            <>
              {/* Nút đổi trạng thái */}
              <div className="flex flex-wrap items-center gap-2">
                {transitions.map((tr) => (
                  <button
                    key={tr.to}
                    type="button"
                    disabled={busy}
                    onClick={() => runStatus(tr.to)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[13px] font-semibold text-ink-800 hover:bg-sand-50 disabled:opacity-50"
                  >
                    {t(tr.label)}
                  </button>
                ))}
                {status !== "CANCELLED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={runCancel}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-danger/40 px-3.5 text-[13px] font-semibold text-danger hover:bg-danger-soft disabled:opacity-50"
                  >
                    {t("Hủy")}
                  </button>
                ) : null}
              </div>

              {/* LƯU TRÚ */}
              <section className="mt-6">
                <h3 className={sectionHead}>{t("Lưu trú")}</h3>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="d-in" className={label}>{t("Nhận phòng")}</label>
                    <input id="d-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className={input} />
                  </div>
                  <div>
                    <label htmlFor="d-out" className={label}>{t("Trả phòng")}</label>
                    <input id="d-out" type="date" min={checkIn} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className={input} />
                  </div>
                </div>

                <div className="mt-3">
                  <label htmlFor="d-source" className={label}>{t("Nguồn đặt phòng")}</label>
                  <select id="d-source" value={source} onChange={(e) => setSource(e.target.value)} className={input}>
                    <option value="DIRECT">{t("Thủ công / khách vãng lai")}</option>
                    <option value="AIRBNB">Airbnb</option>
                    <option value="BOOKING_COM">Booking.com</option>
                    <option value="AGODA">Agoda</option>
                    <option value="TRAVELOKA">Traveloka</option>
                    <option value="OTHER">{t("Kênh khác")}</option>
                  </select>
                </div>

                <div className="mt-3">
                  <label htmlFor="d-room" className={label}>{t("Phòng được gán")}</label>
                  <select id="d-room" value={roomId} onChange={(e) => setRoomId(e.target.value)} className={input}>
                    {roomGroups.map((g) => (
                      <optgroup key={g.name} label={g.name}>
                        {g.rooms.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="d-adults" className={label}>{t("Người lớn")}</label>
                    <input id="d-adults" type="number" min={0} max={50} value={adults} onChange={(e) => setAdults(e.target.value)} className={`${input} tnum`} />
                  </div>
                  <div>
                    <label htmlFor="d-children" className={label}>{t("Trẻ em")}</label>
                    <input id="d-children" type="number" min={0} max={50} value={children} onChange={(e) => setChildren(e.target.value)} className={`${input} tnum`} />
                  </div>
                  <div>
                    <label htmlFor="d-infants" className={label}>{t("Em bé")}</label>
                    <input id="d-infants" type="number" min={0} max={50} value={infants} onChange={(e) => setInfants(e.target.value)} className={`${input} tnum`} />
                  </div>
                </div>

                <div className="mt-3">
                  <label htmlFor="d-discount" className={label}>{t("Giảm giá")}</label>
                  <div className="relative">
                    <input
                      id="d-discount"
                      inputMode="numeric"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value.replace(/\D/g, ""))}
                      placeholder="0"
                      className={`${input} tnum pr-12`}
                    />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-medium text-ink-400">
                      {currency}
                    </span>
                  </div>
                </div>
              </section>

              {/* GHI CHÚ */}
              <section className="mt-6">
                <h3 className={sectionHead}>{t("Ghi chú")}</h3>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${input} min-h-20 py-2.5`} />
              </section>

              {/* THANH TOÁN */}
              <section className="mt-6">
                <div className="flex items-baseline justify-between">
                  <h3 className={sectionHead}>{t("Thanh toán")}</h3>
                  <span className="tnum text-[13px] text-ink-600">
                    {payable === null
                      ? t("Chưa có giá")
                      : `${money.format(paid)} / ${money.format(payable)} ${currency}`}
                  </span>
                </div>

                {payable !== null ? (
                  <div className="mt-3 rounded-xl border border-line p-4">
                    <label htmlFor="d-pay" className={label}>{t("Số tiền")}</label>
                    <div className="mt-1.5 grid grid-cols-4 gap-2">
                      {(
                        [
                          { label: t("Không"), part: 0 },
                          { label: "25%", part: 0.25 },
                          { label: "50%", part: 0.5 },
                          { label: t("Còn lại"), part: 1 },
                        ] as const
                      ).map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => setPayAmount(String(Math.round((outstanding ?? 0) * c.part)))}
                          className="h-8 rounded-lg bg-sand-100 px-2 text-[12px] font-semibold text-ink-700 hover:bg-sand-200"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    <div className="relative mt-2">
                      <input
                        id="d-pay"
                        inputMode="numeric"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value.replace(/\D/g, ""))}
                        placeholder="0"
                        className={`${input} tnum pr-12`}
                      />
                      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] font-medium text-ink-400">
                        {currency}
                      </span>
                    </div>

                    <div className="mt-2 flex items-end gap-2">
                      <div className="flex-1">
                        <label htmlFor="d-method" className={label}>{t("Phương thức")}</label>
                        <select
                          id="d-method"
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value as PaymentMethodName)}
                          className={input}
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>{t(PAYMENT_METHOD_LABEL[m])}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        disabled={busy || !payAmount || Number(payAmount) <= 0}
                        onClick={runPay}
                        className="inline-flex h-10 items-center gap-1 rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-50"
                      >
                        <span aria-hidden="true">+</span>
                        {t("Thêm")}
                      </button>
                    </div>

                    {detail.payments.length > 0 ? (
                      <ol className="mt-4 space-y-2 border-t border-line pt-3">
                        {detail.payments.map((p) => (
                          <li key={p.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                            <span className="text-ink-600">
                              {p.createdAt}
                              <span className="text-ink-400">
                                {" · "}
                                {t(PAYMENT_METHOD_LABEL[(p.method as PaymentMethodName)] ?? PAYMENT_METHOD_LABEL.OTHER)}
                              </span>
                            </span>
                            <span className="flex items-baseline gap-2">
                              <span className="tnum font-medium text-ink-900">{money.format(p.amount)} {currency}</span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => runDeletePayment(p.id)}
                                aria-label={t("Xóa lần thu này")}
                                title={t("Xóa lần thu này")}
                                className="grid size-6 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                              >
                                <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M4 7h16M9 7V5h6v2M10 11v6M14 11v6M6 7l1 13h10l1-13" />
                                </svg>
                              </button>
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-[13px] text-ink-500">
                    {t("Đặt giá cho đơn (ở ô tổng tiền) rồi mới ghi nhận thanh toán được.")}
                  </p>
                )}
              </section>
            </>
          ) : detail && !detail.editable ? (
            <p className="rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-[14px] leading-relaxed text-warning">
              {t("Đặt phòng này do người khác tạo. Bạn xem được nhưng chưa được cấp quyền sửa.")}
            </p>
          ) : null}
        </div>

        {/* Chân drawer */}
        {detail && detail.editable ? (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
            <button
              type="button"
              onClick={close}
              className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-ink-700 hover:border-ink-900"
            >
              {t("Đóng")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={runSave}
              className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? t("Đang lưu…") : t("Lưu thay đổi")}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
