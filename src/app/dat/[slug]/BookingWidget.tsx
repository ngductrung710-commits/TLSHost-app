"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { GuestState } from "./actions";

// Reads the page's theme variables rather than the app's palette: this
// component renders inside a host's chosen look, and hardcoded ink-900 on a
// dark preset is white text on white.
const inputClass =
  "mt-1.5 block min-h-11 w-full border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[16px] text-[var(--ink)] outline-none focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]/25";

const roundedField = { borderRadius: "calc(var(--radius) * 0.6)" } as const;

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-60"
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
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--accent)] px-5 text-[14px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90"
      >
        Chọn phòng này
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="relative mt-5 space-y-4 border-t border-[var(--line)] pt-5"
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
          className="block text-[14px] font-medium"
        >
          Tên của bạn
        </label>
        <input
          id={`name-${roomId}`}
          name="guestName"
          required
          autoComplete="name"
          className={inputClass}
          style={roundedField}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`email-${roomId}`}
            className="block text-[14px] font-medium"
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
            style={roundedField}
          />
        </div>
        <div>
          <label
            htmlFor={`phone-${roomId}`}
            className="block text-[14px] font-medium"
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
            style={roundedField}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`guests-${roomId}`}
          className="block text-[14px] font-medium"
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
          className="block text-[14px] font-medium"
        >
          Ghi chú cho chủ nhà{" "}
          <span className="font-normal text-[var(--ink-soft)]">(không bắt buộc)</span>
        </label>
        <textarea
          id={`notes-${roomId}`}
          name="notes"
          rows={3}
          defaultValue=""
          className={inputClass + " min-h-24 py-2.5"}
          style={roundedField}
        />
      </div>

      <Submit />

      <button
        type="button"
        onClick={() => setOpen(false)}
        className="block min-h-11 w-full text-center text-[14px] text-[var(--ink-soft)] hover:text-[var(--ink)]"
      >
        Bỏ chọn phòng này
      </button>
    </form>
  );
}
