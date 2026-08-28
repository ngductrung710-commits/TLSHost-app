"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { AssistantState } from "./actions";

const EXAMPLES = [
  "Khóa Garden Suite từ 5 đến 8 tháng 12 để sơn lại phòng tắm",
  "Chị Lan đặt Sky Loft 20 đến 23 tháng 11, hai người, số 0905123456",
  "Đặt giá Ocean View Studio thành 1.600.000 một đêm",
];

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Đang soạn…" : "Nhờ trợ lý soạn"}
    </button>
  );
}

export function AskForm({
  action,
  disabled,
}: {
  action: (prev: AssistantState, formData: FormData) => Promise<AssistantState>;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState<AssistantState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-2xl space-y-4">
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
          htmlFor="prompt"
          className="block text-[14px] font-medium text-ink-700"
        >
          Bạn cần làm gì?
        </label>
        <textarea
          id="prompt"
          name="prompt"
          rows={3}
          required
          disabled={disabled}
          placeholder={EXAMPLES[0]}
          aria-describedby="prompt-hint"
          className="mt-1.5 block min-h-24 w-full rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15 disabled:bg-sand-50 disabled:text-ink-400"
        />
        <p
          id="prompt-hint"
          className="mt-2 text-[13px] leading-relaxed text-ink-500"
        >
          Ví dụ:{" "}
          {EXAMPLES.slice(1)
            .map((e) => `“${e}”`)
            .join(" · ")}
        </p>
      </div>

      <Submit disabled={disabled} />
    </form>
  );
}
