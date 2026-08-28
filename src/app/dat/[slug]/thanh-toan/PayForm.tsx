"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { PayState } from "./actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Đang mở trang thanh toán…" : label}
    </button>
  );
}

export function PayForm({
  action,
  slug,
  bookingId,
  providers,
}: {
  action: (prev: PayState, formData: FormData) => Promise<PayState>;
  slug: string;
  bookingId: string;
  providers: ("STRIPE" | "PAYPAL")[];
}) {
  const [state, formAction] = useActionState<PayState, FormData>(action, {
    error: null,
  });

  return (
    <div className="space-y-3">
      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] leading-relaxed text-danger"
        >
          {state.error} Bạn vẫn giữ phòng — có thể trả khi nhận phòng.
        </p>
      ) : null}

      {providers.map((provider) => (
        <form key={provider} action={formAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="provider" value={provider} />
          <Submit
            label={`Thanh toán qua ${provider === "STRIPE" ? "thẻ" : "PayPal"}`}
          />
        </form>
      ))}
    </div>
  );
}
