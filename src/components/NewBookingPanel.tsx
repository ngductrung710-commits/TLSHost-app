"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { useT } from "@/components/I18nProvider";
import type { BookingState } from "@/app/(app)/lich/actions";
import { AUTO_ROOM } from "@/lib/bookingForm";
import { fill, type Locale } from "@/lib/i18n";

/**
 * Tạo đơn đặt phòng bằng một ngăn kéo ba bước, mở ngay trên bảng lịch.
 *
 * Ba bước chứ không phải một form dài: cùng chừng ấy ô, nhưng chia theo ba câu
 * hỏi tách bạch — ở đâu và bao lâu, ai ở, trả tiền thế nào. Bấm vào một ô
 * trống trên lịch là đã trả lời xong gần hết bước một, nên phần lớn thời gian
 * bước ấy chỉ để nhìn lại cho chắc.
 *
 * Văn bản trên ngăn kéo giữ đúng từng chữ của bản thiết kế được đưa.
 *
 * Hai ô mà bản thiết kế có còn ở đây thì không: "Loại phòng" và "Gói giá".
 * Cả hai đều cần những thứ ứng dụng này chưa có — hạng phòng, và bảng giá có
 * tên. Bày ra một ô select chỉ có đúng một dòng để trông cho giống thì tệ hơn
 * là không bày: nó hứa một cách phân loại không tồn tại.
 */

type RoomOption = {
  id: string;
  name: string;
  propertyName: string;
  /** Minor units mỗi đêm. Null khi phòng chưa được đặt giá. */
  basePrice: number | null;
};

/* -------------------------------------------------------------------------- */
/* Mở ngăn kéo từ một ô trống trên lịch                                        */
/* -------------------------------------------------------------------------- */

/**
 * Ô ngày nằm trong BoardGrid, ngăn kéo nằm trong trang lịch — hai cây con khác
 * nhau, không có tổ tiên chung nào tiện để đặt context. Một kho nhỏ ngoài
 * React nối chúng lại, đúng lối đã dùng cho DisplayOptions và BoardMode.
 */
export type OpenRequest = {
  roomId: string;
  from: string;
  /** Ngày trả phòng, khi mở từ một cú kéo nhiều đêm. Bỏ trống thì một đêm. */
  to?: string;
} | null;

let pending: OpenRequest = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): OpenRequest {
  return pending;
}

function serverSnapshot(): OpenRequest {
  return null;
}

/** Gọi từ một ô trống, hoặc một cú kéo, trên lịch. */
export function openNewBooking(request: {
  roomId: string;
  from: string;
  to?: string;
}): void {
  pending = request;
  for (const listener of listeners) listener();
}

function clearRequest(): void {
  pending = null;
  for (const listener of listeners) listener();
}

/* -------------------------------------------------------------------------- */
/* Ngày tháng và tiền                                                          */
/* -------------------------------------------------------------------------- */

/** Cộng ngày cho một chuỗi YYYY-MM-DD, làm việc ở UTC nên không lệch múi giờ. */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/* -------------------------------------------------------------------------- */

const STEPS = 3;

export function NewBookingPanel({
  rooms,
  action,
  locale,
  currency,
  today,
}: {
  rooms: RoomOption[];
  action: (prev: BookingState, formData: FormData) => Promise<BookingState>;
  locale: Locale;
  /** Ký hiệu tiền tệ của tổ chức, đã đổi sẵn phía máy chủ. */
  currency: string;
  /** Hôm nay theo múi giờ của tổ chức, dạng YYYY-MM-DD. */
  today: string;
}) {
  const t = useT();
  const request = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [roomId, setRoomId] = useState(AUTO_ROOM);
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [infants, setInfants] = useState("0");

  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const [source, setSource] = useState("DIRECT");
  const [notes, setNotes] = useState("");
  const [deposit, setDeposit] = useState(0);
  const [depositPaid, setDepositPaid] = useState(false);

  /**
   * Một ô trống trên lịch vừa được bấm.
   *
   * Xử lý trong lúc render chứ không trong một effect: đọc kho ngoài rồi gọi
   * setState trong effect là đúng thứ luật react-hooks/set-state-in-effect
   * chặn, và luật đó đúng — ngăn kéo sẽ hiện ra một nhịp với ngày cũ trước khi
   * nhảy sang ngày vừa bấm.
   */
  if (request) {
    const from = request.from;
    // Ngày trả phòng: lấy từ cú kéo nếu có và hợp lệ, không thì một đêm.
    const to =
      request.to && nightsBetween(from, request.to) >= 1
        ? request.to
        : addDays(from, 1);
    clearRequest();
    setCheckIn(from);
    setCheckOut(to);
    setRoomId(request.roomId);
    setStep(0);
    setError(null);
    setDeposit(0);
    setDepositPaid(false);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN");
  const nights = nightsBetween(checkIn, checkOut);
  const room = rooms.find((r) => r.id === roomId) ?? null;
  const total = room?.basePrice != null ? room.basePrice * nights : null;
  const remaining = total === null ? null : Math.max(0, total - deposit);

  const nAdults = Number(adults) || 0;
  const nChildren = Number(children) || 0;
  const nInfants = Number(infants) || 0;

  function reset() {
    setStep(0);
    setError(null);
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setNotes("");
    setSource("DIRECT");
    setDeposit(0);
    setDepositPaid(false);
    setAdults("1");
    setChildren("0");
    setInfants("0");
    // Nút trên thanh công cụ mở một đơn "từ đầu": phòng về tự động, ngày về
    // hôm nay. Khác với lúc bấm một ô trống trên lịch — chỗ đó đặt sẵn phòng
    // và ngày qua request, và nhánh đó chạy sau reset nên vẫn thắng.
    setRoomId(AUTO_ROOM);
    setCheckIn(today);
    setCheckOut(addDays(today, 1));
  }

  /** Điều kiện để đi tiếp, kiểm ngay tại bước đang đứng. */
  function blocking(atStep: number): string | null {
    if (atStep === 0) {
      if (nights < 1) return t("Ngày trả phòng phải sau ngày nhận phòng.");
      if (nAdults + nChildren < 1) return t("Cần ít nhất một khách.");
      return null;
    }
    if (atStep === 1) {
      // Đúng câu của bản thiết kế, kể cả khi máy chủ cũng nói một câu tương
      // tự: câu ở đây xuất hiện ngay lúc bấm Tiếp, không phải sau một vòng
      // gửi lên và nhận về.
      if (guestName.trim() === "") return t("Bắt buộc nhập tên khách.");
      return null;
    }
    return null;
  }

  function next() {
    const problem = blocking(step);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep((s) => Math.min(STEPS - 1, s + 1));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    for (let i = 0; i < STEPS; i++) {
      const problem = blocking(i);
      if (problem) {
        setError(problem);
        setStep(i);
        return;
      }
    }

    const formData = new FormData();
    formData.set("roomId", roomId);
    formData.set("checkIn", checkIn);
    formData.set("checkOut", checkOut);
    formData.set("guestName", guestName.trim());
    formData.set("guestEmail", guestEmail.trim());
    formData.set("guestPhone", guestPhone.trim());
    formData.set("guests", String(nAdults + nChildren));
    formData.set("adults", String(nAdults));
    formData.set("children", String(nChildren));
    formData.set("infants", String(nInfants));
    formData.set("source", source);
    formData.set("notes", notes.trim());
    formData.set("depositCents", String(deposit));
    if (depositPaid) formData.set("depositPaid", "on");
    // Không gửi totalCents khi phòng chưa có giá hoặc khi để hệ thống tự gán:
    // máy chủ biết phòng nào cuối cùng được chọn, và nó tính lại từ giá của
    // đúng phòng đó. Gửi một số 0 lên thì cái 0 ấy được lưu như một sự thật.
    if (total !== null) formData.set("totalCents", String(total));

    // Đóng trước khi chờ, cùng lý do đã ghi trong AddRoomPanel: khi action trả
    // về, revalidatePath đã vẽ lại cây từ máy chủ và lệnh đóng rơi vào một bản
    // dựng khác.
    setOpen(false);
    setBusy(true);
    const result = await action({ error: null }, formData);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      setStep(STEPS - 1);
      setOpen(true);
      return;
    }
    reset();
  }

  const input =
    "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[15px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";
  const label = "block text-[14px] font-medium text-ink-700";

  /** Nhóm phòng theo cơ sở, để ô select không thành một danh sách phẳng. */
  const groups: { name: string; rooms: RoomOption[] }[] = [];
  for (const r of rooms) {
    const last = groups[groups.length - 1];
    if (last && last.name === r.propertyName) last.rooms.push(r);
    else groups.push({ name: r.propertyName, rooms: [r] });
  }

  const title = t("Tạo đơn đặt phòng");

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-dark"
      >
        <span aria-hidden="true" className="text-[15px] leading-none">
          +
        </span>
        {t("Đặt phòng mới")}
      </button>

      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex justify-end">
              <button
                type="button"
                aria-label={t("Đóng")}
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-ink-950/30"
              />

              <div
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl"
              >
                <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                      {t("Đơn đặt mới")}
                    </p>
                    <h2 className="mt-0.5 text-[1.125rem] font-semibold text-ink-900">
                      {title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("Đóng")}
                    className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-sand-100 hover:text-ink-900"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                  {error ? (
                    <p
                      role="alert"
                      className="mb-4 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] leading-relaxed text-danger"
                    >
                      {error}
                    </p>
                  ) : null}

                  {/* Ba vạch tiến độ. Nhãn nằm ở aria-label của cả nhóm chứ
                      không viết ra màn hình — bản thiết kế cũng vậy, và tiêu
                      đề ngay dưới đã nói đang ở bước nào. */}
                  <div
                    role="group"
                    aria-label={fill(t("Bước {n} trên {tong}"), {
                      n: step + 1,
                      tong: STEPS,
                    })}
                    className="flex gap-1.5"
                  >
                    {Array.from({ length: STEPS }, (_, i) => (
                      <span
                        key={i}
                        aria-hidden="true"
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= step ? "bg-brand" : "bg-sand-200"
                        }`}
                      />
                    ))}
                  </div>

                  {/* --- Bước 1 ------------------------------------------- */}
                  <div className={step === 0 ? "" : "hidden"}>
                    <h3 className="mt-5 text-[15px] font-semibold text-ink-900">
                      {t("Bắt đầu với thông tin lưu trú")}
                    </h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-500">
                      {t("Kiểm tra ngày, phòng và số khách trước khi thêm thông tin khách.")}
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="nb-in" className={label}>
                          {t("Nhận phòng")}
                        </label>
                        <input
                          id="nb-in"
                          type="date"
                          value={checkIn}
                          onChange={(e) => {
                            setCheckIn(e.target.value);
                            // Giữ khoảng ngày luôn hợp lệ. Đẩy ngày trả phòng
                            // theo chứ không xoá nó: một ô ngày trống là thứ
                            // phải gõ lại, còn một ngày bị đẩy thì nhìn thấy
                            // ngay và sửa được.
                            if (nightsBetween(e.target.value, checkOut) < 1) {
                              setCheckOut(addDays(e.target.value, 1));
                            }
                          }}
                          className={input}
                        />
                      </div>
                      <div>
                        <label htmlFor="nb-out" className={label}>
                          {t("Trả phòng")}
                        </label>
                        <input
                          id="nb-out"
                          type="date"
                          min={addDays(checkIn, 1)}
                          value={checkOut}
                          onChange={(e) => setCheckOut(e.target.value)}
                          className={input}
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <label htmlFor="nb-room" className={label}>
                        {t("Phòng được gán")}
                      </label>
                      <select
                        id="nb-room"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value)}
                        className={input}
                      >
                        <option value={AUTO_ROOM}>{t("Tự động gán")}</option>
                        {groups.map((group) => (
                          <optgroup key={group.name} label={group.name}>
                            {group.rooms.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="nb-adults" className={label}>
                          {t("Người lớn")}
                        </label>
                        <input
                          id="nb-adults"
                          type="number"
                          min={0}
                          max={50}
                          value={adults}
                          onChange={(e) => setAdults(e.target.value)}
                          className={`${input} tnum`}
                        />
                      </div>
                      <div>
                        <label htmlFor="nb-children" className={label}>
                          {t("Trẻ em")}
                        </label>
                        <input
                          id="nb-children"
                          type="number"
                          min={0}
                          max={50}
                          value={children}
                          onChange={(e) => setChildren(e.target.value)}
                          className={`${input} tnum`}
                        />
                      </div>
                      <div>
                        <label htmlFor="nb-infants" className={label}>
                          {t("Em bé")}
                        </label>
                        <input
                          id="nb-infants"
                          type="number"
                          min={0}
                          max={50}
                          value={infants}
                          onChange={(e) => setInfants(e.target.value)}
                          className={`${input} tnum`}
                        />
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-clay-50 px-4 py-3">
                      <p className="flex items-baseline justify-between gap-3">
                        <span className="tnum text-[14px] font-medium text-ink-700">
                          {fill(t("{n} đêm"), { n: nights })}
                        </span>
                        <span className="tnum text-[15px] font-semibold text-ink-900">
                          {total === null
                            ? t("Chưa có giá")
                            : `${money.format(total)} ${currency}`}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-500">
                        {room
                          ? `${room.propertyName} / ${room.name}`
                          : t("Chọn khi lưu, theo phòng còn trống")}
                      </p>
                    </div>
                  </div>

                  {/* --- Bước 2 ------------------------------------------- */}
                  <div className={step === 1 ? "" : "hidden"}>
                    <h3 className="mt-5 text-[15px] font-semibold text-ink-900">
                      {t("Thêm khách chính")}
                    </h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-500">
                      {t("Nhập khách chính trước. Có thể để trống thông tin liên hệ nếu chưa có.")}
                    </p>

                    <div className="mt-5">
                      <label htmlFor="nb-name" className={label}>
                        {t("Tên")}
                      </label>
                      <input
                        id="nb-name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder={t("Tên khách")}
                        autoComplete="off"
                        className={input}
                      />
                    </div>

                    <div className="mt-4">
                      <label htmlFor="nb-email" className={label}>
                        Email
                      </label>
                      <input
                        id="nb-email"
                        type="email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        className={input}
                      />
                    </div>

                    <div className="mt-4">
                      <label htmlFor="nb-phone" className={label}>
                        {t("Điện thoại")}
                      </label>
                      <input
                        id="nb-phone"
                        type="tel"
                        value={guestPhone}
                        onChange={(e) => setGuestPhone(e.target.value)}
                        placeholder={t("Số điện thoại")}
                        className={input}
                      />
                    </div>
                  </div>

                  {/* --- Bước 3 ------------------------------------------- */}
                  <div className={step === 2 ? "" : "hidden"}>
                    <h3 className="mt-5 text-[15px] font-semibold text-ink-900">
                      {t("Xem lại và thanh toán")}
                    </h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-ink-500">
                      {t("Thêm tiền cọc nếu cần, kiểm tra lại thông tin rồi tạo đơn đặt.")}
                    </p>

                    <div className="mt-5">
                      <label htmlFor="nb-source" className={label}>
                        {t("Nguồn đặt phòng")}
                      </label>
                      <select
                        id="nb-source"
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        className={input}
                      >
                        <option value="DIRECT">{t("Thủ công / khách vãng lai")}</option>
                        <option value="AIRBNB">Airbnb</option>
                        <option value="BOOKING_COM">Booking.com</option>
                        <option value="AGODA">Agoda</option>
                        <option value="TRAVELOKA">Traveloka</option>
                        <option value="OTHER">{t("Kênh khác")}</option>
                      </select>
                    </div>

                    <div className="mt-4">
                      <label htmlFor="nb-notes" className={label}>
                        {t("Ghi chú")}
                      </label>
                      <textarea
                        id="nb-notes"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className={`${input} min-h-24 py-2.5`}
                      />
                    </div>

                    <fieldset className="mt-5 rounded-xl border border-line p-4">
                      <legend className="px-1 text-[14px] font-medium text-ink-700">
                        {t("Tiền cọc")}
                      </legend>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[13px] leading-relaxed text-ink-500">
                          {t("Chọn nhanh, kéo thanh trượt hoặc nhập tiền cọc tùy chỉnh.")}
                        </p>
                        <p className="tnum shrink-0 text-[15px] font-semibold text-ink-900">
                          {money.format(deposit)} {currency}
                        </p>
                      </div>

                      {/* Chọn nhanh theo phần trăm chỉ có nghĩa khi biết tổng.
                          Phòng chưa có giá thì tổng là null, và bốn cái nút
                          này tắt — một nút "50%" của một số không tồn tại thì
                          bấm vào chỉ ra 0, trông như hỏng. */}
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {(
                          [
                            { label: t("Không"), part: 0 },
                            { label: "25%", part: 0.25 },
                            { label: "50%", part: 0.5 },
                            { label: t("Tổng"), part: 1 },
                          ] as const
                        ).map((choice) => {
                          const value =
                            total === null ? 0 : Math.round(total * choice.part);
                          const on = total !== null && deposit === value;
                          return (
                            <button
                              key={choice.label}
                              type="button"
                              disabled={total === null && choice.part > 0}
                              onClick={() => setDeposit(value)}
                              aria-pressed={on}
                              className={`min-h-9 rounded-lg px-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                on
                                  ? "bg-ink-900 text-sand-100"
                                  : "bg-sand-100 text-ink-700 hover:bg-sand-200"
                              }`}
                            >
                              {choice.label}
                            </button>
                          );
                        })}
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={total ?? 0}
                        step={1000}
                        disabled={total === null}
                        value={deposit}
                        onChange={(e) => setDeposit(Number(e.target.value))}
                        aria-label={t("Tiền cọc")}
                        className="mt-3 w-full accent-brand disabled:opacity-40"
                      />

                      <label htmlFor="nb-deposit" className={`mt-3 ${label}`}>
                        {t("Số tiền tùy chỉnh")}
                      </label>
                      <div className="relative">
                        <input
                          id="nb-deposit"
                          inputMode="numeric"
                          value={deposit === 0 ? "" : String(deposit)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "");
                            setDeposit(digits === "" ? 0 : Number(digits));
                          }}
                          className={`${input} tnum pr-14`}
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] font-medium text-ink-400"
                        >
                          {currency}
                        </span>
                      </div>

                      <label className="mt-3 flex items-center gap-2.5 text-[14px] text-ink-800">
                        <input
                          type="checkbox"
                          checked={depositPaid}
                          onChange={(e) => setDepositPaid(e.target.checked)}
                          className="size-4 accent-ink-900"
                        />
                        {t("Đánh dấu đã thanh toán")}
                      </label>
                    </fieldset>

                    <div className="mt-5 rounded-xl border border-line">
                      <p className="border-b border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                        {t("Tóm tắt đơn đặt")}
                      </p>
                      <dl className="divide-y divide-line/60 text-[14px]">
                        {[
                          { k: t("Ngày"), v: `${checkIn} – ${checkOut}` },
                          {
                            k: t("Phòng được gán"),
                            v: room ? `${room.propertyName} / ${room.name}` : t("Tự động gán"),
                          },
                          { k: t("Khách"), v: guestName.trim() || "—" },
                          {
                            k: t("Số khách"),
                            v: fill(t("{nl} Người lớn / {te} Trẻ em / {eb} Em bé"), {
                              nl: nAdults,
                              te: nChildren,
                              eb: nInfants,
                            }),
                          },
                        ].map((row) => (
                          <div
                            key={row.k}
                            className="flex items-baseline justify-between gap-4 px-4 py-2.5"
                          >
                            <dt className="shrink-0 text-ink-500">{row.k}</dt>
                            <dd className="text-right text-ink-900">{row.v}</dd>
                          </div>
                        ))}
                        {[
                          {
                            k: t("Tổng cộng"),
                            v: total === null ? t("Chưa có giá") : `${money.format(total)} ${currency}`,
                          },
                          { k: t("Tiền cọc"), v: `${money.format(deposit)} ${currency}` },
                          {
                            k: t("Còn lại"),
                            v:
                              remaining === null
                                ? "—"
                                : `${money.format(remaining)} ${currency}`,
                          },
                        ].map((row) => (
                          <div
                            key={row.k}
                            className="flex items-baseline justify-between gap-4 px-4 py-2.5"
                          >
                            <dt className="shrink-0 text-ink-500">{row.k}</dt>
                            <dd className="tnum text-right font-semibold text-ink-900">
                              {row.v}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-ink-700 hover:border-ink-900"
                  >
                    {t("Đóng")}
                  </button>

                  <div className="flex items-center gap-2.5">
                    {step > 0 ? (
                      <button
                        type="button"
                        onClick={back}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-sand-100 px-5 text-[14px] font-semibold text-ink-700 hover:bg-sand-200"
                      >
                        <span aria-hidden="true">←</span>
                        {t("Quay lại")}
                      </button>
                    ) : null}

                    {step < STEPS - 1 ? (
                      <button
                        type="button"
                        onClick={next}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 hover:bg-ink-800"
                      >
                        {t("Tiếp")}
                        <span aria-hidden="true">→</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={submit}
                        disabled={busy}
                        className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busy ? t("Đang lưu…") : t("Tạo đơn đặt")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
