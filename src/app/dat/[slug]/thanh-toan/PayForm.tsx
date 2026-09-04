"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/I18nProvider";
import { fill } from "@/lib/i18n";

import type { PayState } from "./actions";

function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--accent)] px-6 text-[15px] font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? t("Đang mở trang thanh toán…") : label}
    </button>
  );
}

export function PayForm({
  action,
  slug,
  bookingId,
  providers,
  locale,
}: {
  action: (prev: PayState, formData: FormData) => Promise<PayState>;
  slug: string;
  bookingId: string;
  providers: ("STRIPE" | "PAYPAL")[];
  locale: "vi" | "en";
}) {
  const t = useT();
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
          {state.error} {t("Bạn vẫn giữ phòng — có thể trả khi nhận phòng.")}
        </p>
      ) : null}

      {providers.map((provider) => (
        <form key={provider} action={formAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="provider" value={provider} />
          <input type="hidden" name="ng" value={locale} />
          <Submit
            label={fill(t("Thanh toán qua {cong}"), {
              cong: provider === "STRIPE" ? t("thẻ") : "PayPal",
            })}
          />
        </form>
      ))}
    </div>
  );
}
