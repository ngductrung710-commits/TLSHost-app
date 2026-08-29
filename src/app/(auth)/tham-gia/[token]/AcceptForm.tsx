"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AcceptState } from "./actions";
import { useT } from "@/components/I18nProvider";

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? t("Đang xử lý…") : t("Đặt mật khẩu và tham gia")}
    </button>
  );
}

export function AcceptForm({
  action,
  token,
}: {
  action: (prev: AcceptState, formData: FormData) => Promise<AcceptState>;
  token: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState<AcceptState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] leading-relaxed text-danger"
        >
          {t(state.error)}
        </p>
      ) : null}

      <div>
        <label htmlFor="password" className="block text-[14px] font-medium text-ink-700">
          {t("Mật khẩu")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          aria-describedby="password-hint"
          className="mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
        />
        <p id="password-hint" className="mt-1.5 text-[13px] text-ink-500">
          {t("Ít nhất 12 ký tự. Dài quan trọng hơn phức tạp.")}
        </p>
      </div>

      <Submit />
    </form>
  );
}
