"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/I18nProvider";

import type { AuthState } from "../actions";

/**
 * Ask for a reset link.
 *
 * Separate from AuthForm because this one has no success redirect: the action
 * answers identically for an address that exists and one that does not, so
 * there is nowhere to send anybody. The confirmation replaces the form, which
 * is also what stops someone submitting the same address four times while
 * waiting for mail that is already on its way.
 */
function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t("Đang gửi…") : t("Gửi liên kết đặt lại")}
    </button>
  );
}

export function ResetRequestForm({
  action,
}: {
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const t = useT();
  const [state, formAction] = useActionState<AuthState, FormData>(action, {
    error: null,
  });

  if (state.notice) {
    return (
      <p
        role="status"
        className="rounded-xl border border-positive/30 bg-positive-soft px-4 py-3.5 text-[14px] leading-relaxed text-positive"
      >
        {state.notice}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
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
        <label htmlFor="email" className="block text-[14px] font-medium text-ink-700">
          {t("Email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          className="mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
        />
      </div>

      <Submit />
    </form>
  );
}
