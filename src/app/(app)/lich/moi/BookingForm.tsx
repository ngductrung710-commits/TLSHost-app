"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { BookingState } from "../actions";

type RoomOption = { id: string; name: string; propertyName: string };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? "Đang lưu…" : "Tạo đặt phòng"}
    </button>
  );
}

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

export function BookingForm({
  action,
  rooms,
  defaultRoomId,
  defaultCheckIn,
  defaultCheckOut,
}: {
  action: (prev: BookingState, formData: FormData) => Promise<BookingState>;
  rooms: RoomOption[];
  defaultRoomId: string;
  defaultCheckIn: string;
  defaultCheckOut: string;
}) {
  const [state, formAction] = useActionState<BookingState, FormData>(action, {
    error: null,
  });

  // Held in state so the checkout input's `min` tracks the arrival date. The
  // server rejects a backwards range regardless — this only stops a host
  // producing one by accident.
  const [checkIn, setCheckIn] = useState(defaultCheckIn);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
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
          Phòng
        </label>
        <select
          id="roomId"
          name="roomId"
          defaultValue={defaultRoomId}
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
            Nhận phòng
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
            Trả phòng
          </label>
          <input
            id="checkOut"
            name="checkOut"
            type="date"
            required
            min={checkIn}
            defaultValue={defaultCheckOut}
            aria-describedby="checkout-hint"
            className={inputClass}
          />
          <p id="checkout-hint" className="mt-1.5 text-[13px] text-ink-500">
            Đêm cuối là đêm trước ngày này — phòng trống lại từ sáng hôm đó.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="guestName" className="block text-[14px] font-medium text-ink-700">
          Tên khách
        </label>
        <input
          id="guestName"
          name="guestName"
          required
          autoComplete="off"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="guestEmail" className="block text-[14px] font-medium text-ink-700">
            Email <span className="font-normal text-ink-500">(không bắt buộc)</span>
          </label>
          <input
            id="guestEmail"
            name="guestEmail"
            type="email"
            defaultValue=""
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="guestPhone" className="block text-[14px] font-medium text-ink-700">
            Điện thoại <span className="font-normal text-ink-500">(không bắt buộc)</span>
          </label>
          <input
            id="guestPhone"
            name="guestPhone"
            type="tel"
            defaultValue=""
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="guests" className="block text-[14px] font-medium text-ink-700">
            Số khách
          </label>
          <input
            id="guests"
            name="guests"
            type="number"
            min={1}
            max={50}
            defaultValue={2}
            className={inputClass + " tnum"}
          />
        </div>
        <div>
          <label htmlFor="totalCents" className="block text-[14px] font-medium text-ink-700">
            Tổng tiền (₫)
          </label>
          <input
            id="totalCents"
            name="totalCents"
            type="number"
            min={0}
            step={1000}
            defaultValue=""
            className={inputClass + " tnum"}
          />
        </div>
        <div>
          <label htmlFor="source" className="block text-[14px] font-medium text-ink-700">
            Nguồn
          </label>
          <select id="source" name="source" defaultValue="DIRECT" className={inputClass}>
            <option value="DIRECT">Trực tiếp</option>
            <option value="AIRBNB">Airbnb</option>
            <option value="BOOKING_COM">Booking.com</option>
            <option value="AGODA">Agoda</option>
            <option value="TRAVELOKA">Traveloka</option>
            <option value="OTHER">Kênh khác</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="block text-[14px] font-medium text-ink-700">
          Ghi chú <span className="font-normal text-ink-500">(không bắt buộc)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue=""
          className={inputClass + " min-h-24 py-2.5"}
        />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Submit />
        <Link
          href="/lich"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium text-ink-600 hover:text-ink-900"
        >
          Hủy
        </Link>
      </div>
    </form>
  );
}
