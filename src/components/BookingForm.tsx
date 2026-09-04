"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { BookingState } from "@/app/(app)/lich/actions";
import { useT } from "@/components/I18nProvider";
import { currencySymbol } from "@/lib/currencies";
import { fill } from "@/lib/i18n";

/**
 * One form for creating and for editing a booking.
 *
 * Kept as a single component rather than two: the two differ by a hidden id
 * and a button label, and the parts that are easy to get wrong — the checkout
 * date's lower bound, the error region, the focus behaviour — should not have
 * two copies that can drift.
 */

export type RoomOption = { id: string; name: string; propertyName: string };

export type BookingDefaults = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guests: number;
  totalCents: string;
  source: string;
  notes: string;
};

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? t("Đang lưu…") : label}
    </button>
  );
}

export function BookingForm({
  action,
  rooms,
  defaults,
  bookingId,
  submitLabel,
  cancelHref,
  currency,
}: {
  action: (prev: BookingState, formData: FormData) => Promise<BookingState>;
  rooms: RoomOption[];
  defaults: BookingDefaults;
  /** Present when editing. Sent as a hidden field the action re-checks. */
  bookingId?: string;
  submitLabel: string;
  cancelHref: string;
  /** The organization's currency. The label lied about this until 2026-09-04. */
  currency: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState<BookingState, FormData>(action, {
    error: null,
  });

  // Held in state so the checkout input's `min` tracks the arrival date. The
  // server rejects a backwards range regardless — this only stops a host
  // producing one by accident.
  const [checkIn, setCheckIn] = useState(defaults.checkIn);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {bookingId ? <input type="hidden" name="id" value={bookingId} /> : null}

      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] leading-relaxed text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div>
        <label htmlFor="roomId" className="block text-[14px] font-medium text-ink-700">
          {t("Phòng")}
        </label>
        <select
          id="roomId"
          name="roomId"
          defaultValue={defaults.roomId}
          className={inputClass}
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.propertyName} — {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="checkIn" className="block text-[14px] font-medium text-ink-700">
            {t("Nhận phòng")}
          </label>
          <input
            id="checkIn"
            name="checkIn"
            type="date"
            required
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="checkOut" className="block text-[14px] font-medium text-ink-700">
            {t("Trả phòng")}
          </label>
          <input
            id="checkOut"
            name="checkOut"
            type="date"
            required
            min={checkIn}
            defaultValue={defaults.checkOut}
            aria-describedby="checkout-hint"
            className={inputClass}
          />
          <p id="checkout-hint" className="mt-1.5 text-[13px] text-ink-500">
            {t("Đêm cuối là đêm trước ngày này — phòng trống lại từ sáng hôm đó.")}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="guestName" className="block text-[14px] font-medium text-ink-700">
          {t("Tên khách")}
        </label>
        <input
          id="guestName"
          name="guestName"
          required
          autoComplete="off"
          defaultValue={defaults.guestName}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="guestEmail" className="block text-[14px] font-medium text-ink-700">
            Email <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
          </label>
          <input
            id="guestEmail"
            name="guestEmail"
            type="email"
            defaultValue={defaults.guestEmail}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="guestPhone" className="block text-[14px] font-medium text-ink-700">
            {t("Điện thoại")} <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
          </label>
          <input
            id="guestPhone"
            name="guestPhone"
            type="tel"
            defaultValue={defaults.guestPhone}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="guests" className="block text-[14px] font-medium text-ink-700">
            {t("Số khách")}
          </label>
          <input
            id="guests"
            name="guests"
            type="number"
            min={1}
            max={50}
            defaultValue={defaults.guests}
            className={inputClass + " tnum"}
          />
        </div>
        <div>
          <label htmlFor="totalCents" className="block text-[14px] font-medium text-ink-700">
            {fill(t("Tổng tiền ({tien})"), { tien: currencySymbol(currency) })}
          </label>
          <input
            id="totalCents"
            name="totalCents"
            type="number"
            min={0}
            step={1000}
            defaultValue={defaults.totalCents}
            className={inputClass + " tnum"}
          />
        </div>
        <div>
          <label htmlFor="source" className="block text-[14px] font-medium text-ink-700">
            {t("Nguồn")}
          </label>
          <select
            id="source"
            name="source"
            defaultValue={defaults.source}
            className={inputClass}
          >
            <option value="DIRECT">{t("Trực tiếp")}</option>
            <option value="AIRBNB">Airbnb</option>
            <option value="BOOKING_COM">Booking.com</option>
            <option value="AGODA">Agoda</option>
            <option value="TRAVELOKA">Traveloka</option>
            <option value="OTHER">{t("Kênh khác")}</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-[14px] font-medium text-ink-700">
          {t("Ghi chú")} <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaults.notes}
          className={inputClass + " min-h-24 py-2.5"}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Submit label={submitLabel} />
        <Link
          href={cancelHref}
          className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium text-ink-600 hover:text-ink-900"
        >
          {t("Hủy")}
        </Link>
      </div>
    </form>
  );
}
