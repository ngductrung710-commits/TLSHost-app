"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthState } from "./actions";

/**
 * The sign-in and sign-up forms. One component, because they differ by three
 * fields and a heading, and keeping them together means the error handling and
 * focus behaviour cannot drift apart.
 */

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Đang xử lý…" : label}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
  hint,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div>
      <label htmlFor={name} className="block text-[14px] font-medium text-ink-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        aria-describedby={hintId}
        className="mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-[13px] text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function AuthForm({
  mode,
  action,
}: {
  mode: "signIn" | "signUp";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
}) {
  const [state, formAction] = useActionState<AuthState, FormData>(action, {
    error: null,
  });

  const signUp = mode === "signUp";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {/* role="alert" so the message is announced when it appears, rather than
          only being visible. tabIndex -1 lets the browser move focus here on
          failure without adding it to the tab order afterwards. */}
      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {state.error}
        </p>
      ) : null}

      {signUp ? (
        <>
          <Field label="Tên của bạn" name="name" autoComplete="name" />
          <Field
            label="Tên cơ sở"
            name="orgName"
            hint="Tên bạn dùng để gọi chỗ nghỉ của mình. Đổi được sau."
          />
        </>
      ) : null}

      <Field label="Email" name="email" type="email" autoComplete="email" />

      <Field
        label="Mật khẩu"
        name="password"
        type="password"
        autoComplete={signUp ? "new-password" : "current-password"}
        hint={signUp ? "Ít nhất 12 ký tự. Dài quan trọng hơn phức tạp." : undefined}
      />

      <Submit label={signUp ? "Tạo tài khoản" : "Đăng nhập"} />

      <p className="pt-2 text-center text-[14px] text-ink-500">
        {signUp ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <Link
          href={signUp ? "/dang-nhap" : "/dang-ky"}
          className="font-semibold text-ink-900 underline underline-offset-4"
        >
          {signUp ? "Đăng nhập" : "Tạo tài khoản chủ nhà"}
        </Link>
      </p>
    </form>
  );
}
