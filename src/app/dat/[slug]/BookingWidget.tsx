"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { GuestState } from "./actions";

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? "Đang gửi…" : "Đặt phòng này"}
    </button>
  );
}

/**
 * Collapsed until a guest picks a room, so a page listing four rooms reads as a
 * list of four rooms rather than a wall of four identical forms.
 */
export function BookingWidget({
  action,
  slug,
  roomId,
  checkIn,
  checkOut,
  maxGuests,
}: {
  action: (prev: GuestState, formData: FormData) => Promise<GuestState>;
  slug: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  maxGuests: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<GuestState, FormData>(action, {
    error: null,
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 hover:bg-ink-800"
      >
        Chọn phòng này
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="relative mt-5 space-y-4 border-t border-line pt-5"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="roomId" value={roomId} />
      <input type="hidden" name="checkIn" value={checkIn} />
      <input type="hidden" name="checkOut" value={checkOut} />

      {/* Positioned off-screen rather than display:none — some bots skip
          hidden fields but fill anything they can reach. aria-hidden and
          tabIndex keep it away from anyone using a screen reader or keyboard,
          who would otherwise be asked for a company name that must stay
          empty. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-0">
        <label htmlFor={`company-${roomId}`}>Công ty</label>
        <input
          id={`company-${roomId}`}
          name="company"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

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
        <label
          htmlFor={`name-${roomId}`}
          className="block text-[14px] font-medium text-ink-700"
        >
          Tên của bạn
        </label>
        <input
          id={`name-${roomId}`}
          name="guestName"
          required
          autoComplete="name"
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`email-${roomId}`}
            className="block text-[14px] font-medium text-ink-700"
          >
            Email
          </label>
          <input
            id={`email-${roomId}`}
            name="guestEmail"
            type="email"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor={`phone-${roomId}`}
            className="block text-[14px] font-medium text-ink-700"
          >
            Điện thoại
          </label>
          <input
            id={`phone-${roomId}`}
            name="guestPhone"
            type="tel"
            required
            autoComplete="tel"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`guests-${roomId}`}
          className="block text-[14px] font-medium text-ink-700"
        >
          Số khách
        </label>
        <input
          id={`guests-${roomId}`}
          name="guests"
          type="number"
          min={1}
          max={maxGuests}
          defaultValue={2}
          className={inputClass + " tnum"}
        />
      </div>

      <div>
        <label
          htmlFor={`notes-${roomId}`}
          className="block text-[14px] font-medium text-ink-700"
        >
          Ghi chú cho chủ nhà{" "}
          <span className="font-normal text-ink-500">(không bắt buộc)</span>
        </label>
        <textarea
          id={`notes-${roomId}`}
          name="notes"
          rows={3}
          defaultValue=""
          className={inputClass + " min-h-24 py-2.5"}
        />
      </div>

      <Submit />

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="block min-h-11 w-full text-center text-[14px] text-ink-500 hover:text-ink-900"
      >
        Bỏ chọn phòng này
      </button>
    </form>
  );
}
