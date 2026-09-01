"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/I18nProvider";

import type { BuyState } from "./actions";

/**
 * "Buy one month" on a plan card.
 *
 * One button per paid plan rather than a single upgrade flow with a picker:
 * the cards already show what each plan gives, and asking again on the next
 * screen is a question the host has just answered.
 */
function Submit({ label }: { label: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-full bg-brand px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? t("Đang mở đơn…") : label}
    </button>
  );
}

export function BuyButton({
  action,
  plan,
  label,
}: {
  action: (prev: BuyState, formData: FormData) => Promise<BuyState>;
  plan: string;
  label: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState<BuyState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="plan" value={plan} />
      <Submit label={label} />
      {state.error ? (
        <p role="alert" className="mt-2 text-[12.5px] leading-relaxed text-danger">
          {t(state.error)}
        </p>
      ) : null}
    </form>
  );
}
