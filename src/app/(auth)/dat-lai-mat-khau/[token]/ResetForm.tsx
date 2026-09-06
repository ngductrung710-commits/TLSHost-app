"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/I18nProvider";
import { fill } from "@/lib/i18n";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordRules";

import type { AuthState } from "../../actions";

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t("Đang xử lý…") : t("Đặt mật khẩu mới")}
    </button>
  );
}

export function ResetForm({
  action,
  token,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  /** Carried in a hidden field: the action needs it and the URL is not posted. */
  token: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState<AuthState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

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
        <label htmlFor="password" className="block text-[14px] font-medium text-ink-700">
          {t("Mật khẩu mới")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          // new-password, not password: this tells a password manager to offer
          // to generate and store one rather than to fill the old value in.
          autoComplete="new-password"
          autoFocus
          aria-describedby="password-hint"
          className="mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
        />
        <p id="password-hint" className="mt-1.5 text-[13px] text-ink-500">
          {fill(t("Ít nhất {n} ký tự."), { n: MIN_PASSWORD_LENGTH })}
        </p>
      </div>

      <Submit />

      <p className="pt-1 text-[13px] leading-relaxed text-ink-500">
        {t("Đặt lại xong, mọi thiết bị đang đăng nhập sẽ bị đăng xuất.")}
      </p>
    </form>
  );
}
