"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { slugify } from "@/lib/slug";

import type { PublicPageState } from "./actions";
import { useT } from "@/components/I18nProvider";

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? t("Đang lưu…") : t("Lưu")}
    </button>
  );
}

export function PublicPageForm({
  action,
  propertyId,
  origin,
  slug,
  published,
  intro,
  suggestion,
}: {
  action: (prev: PublicPageState, formData: FormData) => Promise<PublicPageState>;
  propertyId: string;
  origin: string;
  slug: string | null;
  published: boolean;
  intro: string | null;
  /** The property's name, offered when no slug has been chosen yet. */
  suggestion: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState<PublicPageState, FormData>(action, {
    error: null,
  });

  // Shown live under the field so a host sees the URL they are about to
  // publish, not just the words they typed. Uses the same function the server
  // does rather than a copy of it — two implementations of "what is this
  // slug" drift, and the one a host sees would stop matching the one that
  // gets saved. slug.ts is deliberately free of server-only imports so both
  // sides can share it.
  const [draft, setDraft] = useState(slug ?? "");
  const preview = slugify(draft);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <input type="hidden" name="propertyId" value={propertyId} />

      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {t(state.error)}
        </p>
      ) : null}

      {state.notice ? (
        <p
          role="status"
          className="rounded-xl border border-positive/25 bg-positive-soft px-4 py-3 text-[14px] text-positive"
        >
          {t(state.notice)}
        </p>
      ) : null}

      <div>
        <label htmlFor="slug" className="block text-[14px] font-medium text-ink-700">
          {t("Đường dẫn")}
        </label>
        <input
          id="slug"
          name="slug"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={suggestion}
          aria-describedby="slug-preview"
          className={inputClass}
        />
        <p id="slug-preview" className="mt-1.5 font-mono text-[12.5px] text-ink-500">
          {preview ? `${origin}/dat/${preview}` : `${origin}/dat/…`}
        </p>
      </div>

      <div>
        <label htmlFor="intro" className="block text-[14px] font-medium text-ink-700">
          {t("Giới thiệu")} <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
        </label>
        <textarea
          id="intro"
          name="intro"
          rows={3}
          defaultValue={intro ?? ""}
          maxLength={600}
          aria-describedby="intro-hint"
          className={inputClass + " min-h-24 py-2.5"}
        />
        <p id="intro-hint" className="mt-1.5 text-[13px] text-ink-500">
          {t("Vài dòng khách đọc trước khi đặt. Không bắt buộc.")}
        </p>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="published"
          defaultChecked={published}
          className="mt-1 h-4 w-4 rounded border-line-strong"
        />
        <span className="text-[14px] leading-relaxed text-ink-700">
          {t("Mở trang cho khách")}
          <span className="mt-0.5 block text-[13px] text-ink-500">
            {t("Tắt đi thì trang biến mất khỏi internet nhưng đường dẫn vẫn giữ, bật lại lúc nào cũng được.")}
          </span>
        </span>
      </label>

      <div className="pt-1">
        <Submit />
      </div>
    </form>
  );
}
