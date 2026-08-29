"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { PaymentState } from "./paymentActions";
import { useT } from "@/components/I18nProvider";
import { fill } from "@/lib/i18n";

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 font-mono text-[14px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

const COPY = {
  STRIPE: {
    name: "Stripe",
    publicLabel: "Publishable key",
    publicHint: "pk_live_… hoặc pk_test_…",
    secretLabel: "Secret key",
    secretHint: "sk_live_… hoặc sk_test_… — lấy ở Developers → API keys.",
  },
  PAYPAL: {
    name: "PayPal",
    publicLabel: "Client ID",
    publicHint: "Lấy ở Apps & Credentials trong tài khoản Business.",
    secretLabel: "Client secret",
    secretHint: "Cùng chỗ với Client ID, bấm Show để xem.",
  },
} as const;

function Submit({ name }: { name: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? t("Đang kiểm tra khoá…") : fill(t("Kết nối {ten}"), { ten: name })}
    </button>
  );
}

export function PaymentForm({
  action,
  provider,
  connected,
  live,
  publicId,
}: {
  action: (prev: PaymentState, formData: FormData) => Promise<PaymentState>;
  provider: "STRIPE" | "PAYPAL";
  connected: boolean;
  live: boolean;
  publicId: string | null;
}) {
  const t = useT();
  const [state, formAction] = useActionState<PaymentState, FormData>(action, {
    error: null,
  });
  const [open, setOpen] = useState(!connected);
  const copy = COPY[provider];

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-ink-900">{copy.name}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-500">
            {connected ? (
              <>
                {t("Đã kết nối")}
                {live ? "" : t(" · chế độ thử nghiệm")}
                {publicId ? ` · ${publicId.slice(0, 12)}…` : ""}
              </>
            ) : (
              t("Chưa kết nối")
            )}
          </p>
        </div>

        {connected ? (
          <span className="rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-positive">
            {t("Hoạt động")}
          </span>
        ) : null}
      </div>

      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="mt-4 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[13.5px] leading-relaxed text-danger"
        >
          {t(state.error)}
        </p>
      ) : null}
      {state.notice ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-positive/25 bg-positive-soft px-4 py-3 text-[13.5px] text-positive"
        >
          {t(state.notice)}
        </p>
      ) : null}

      {open ? (
        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="provider" value={provider} />

          <div>
            <label
              htmlFor={`public-${provider}`}
              className="block text-[14px] font-medium text-ink-700"
            >
              {copy.publicLabel}
            </label>
            <input
              id={`public-${provider}`}
              name="publicId"
              required
              defaultValue={publicId ?? ""}
              placeholder={copy.publicHint}
              autoComplete="off"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor={`secret-${provider}`}
              className="block text-[14px] font-medium text-ink-700"
            >
              {copy.secretLabel}
            </label>
            {/* type=password so it does not sit readable on a shared screen,
                and autoComplete off so no manager offers to remember it. */}
            <input
              id={`secret-${provider}`}
              name="secret"
              type="password"
              required
              autoComplete="off"
              aria-describedby={`secret-hint-${provider}`}
              className={inputClass}
            />
            <p
              id={`secret-hint-${provider}`}
              className="mt-1.5 text-[13px] leading-relaxed text-ink-500"
            >
              {t(copy.secretHint)}{" "}
              {t(
                t("Khoá được mã hoá trước khi lưu và không bao giờ hiện lại trên màn hình này."),
              )}
            </p>
          </div>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="live"
              defaultChecked={live}
              className="mt-1 h-4 w-4 rounded border-line-strong"
            />
            <span className="text-[14px] leading-relaxed text-ink-700">
              {t("Chế độ thật")}
              <span className="mt-0.5 block text-[13px] text-ink-500">
                {t("Bỏ trống để chạy sandbox. Khách sẽ không bị trừ tiền thật.")}
              </span>
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Submit name={copy.name} />
            {connected ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 px-3 text-[14px] font-medium text-ink-500 hover:text-ink-900"
              >
                {t("Hủy")}
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 flex min-h-11 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-50"
        >
          {t("Đổi khoá")}
        </button>
      )}
    </div>
  );
}
