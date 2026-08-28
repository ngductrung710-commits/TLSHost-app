"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { ChannelState } from "./actions";

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? "Đang lưu…" : "Kết nối kênh"}
    </button>
  );
}

export function ConnectForm({
  action,
  rooms,
}: {
  action: (prev: ChannelState, formData: FormData) => Promise<ChannelState>;
  rooms: { id: string; name: string; propertyName: string }[];
}) {
  const [state, formAction] = useActionState<ChannelState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p
          role="status"
          className="rounded-xl border border-positive/25 bg-positive-soft px-4 py-3 text-[14px] text-positive"
        >
          {state.notice}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="roomId" className="block text-[14px] font-medium text-ink-700">
            Phòng
          </label>
          <select id="roomId" name="roomId" className={inputClass}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.propertyName} — {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kind" className="block text-[14px] font-medium text-ink-700">
            Kênh
          </label>
          <select id="kind" name="kind" defaultValue="AIRBNB" className={inputClass}>
            <option value="AIRBNB">Airbnb</option>
            <option value="BOOKING_COM">Booking.com</option>
            <option value="AGODA">Agoda</option>
            <option value="TRAVELOKA">Traveloka</option>
            <option value="OTHER">Kênh khác</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="importUrl" className="block text-[14px] font-medium text-ink-700">
          Link iCal của kênh
        </label>
        <input
          id="importUrl"
          name="importUrl"
          type="url"
          required
          placeholder="https://www.airbnb.com/calendar/ical/12345.ics?s=..."
          aria-describedby="url-hint"
          className={inputClass + " font-mono text-[13px]"}
        />
        <p id="url-hint" className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          Trong Airbnb: Lịch → Khả dụng → Đồng bộ lịch → Xuất lịch. Link này là
          chìa khoá vào lịch của bạn, đừng chia sẻ ra ngoài.
        </p>
      </div>

      <div>
        <label htmlFor="label" className="block text-[14px] font-medium text-ink-700">
          Ghi chú <span className="font-normal text-ink-500">(không bắt buộc)</span>
        </label>
        <input id="label" name="label" defaultValue="" className={inputClass} />
      </div>

      <div className="pt-1">
        <Submit />
      </div>
    </form>
  );
}
