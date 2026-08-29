"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { PropertyState } from "../actions";
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
      {pending ? t("Đang lưu…") : t("Tạo chỗ nghỉ")}
    </button>
  );
}

export function PropertyForm({
  action,
}: {
  action: (prev: PropertyState, formData: FormData) => Promise<PropertyState>;
}) {
  const t = useT();
  const [state, formAction] = useActionState<PropertyState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {t(state.error)}
        </p>
      ) : null}

      <div>
        <label htmlFor="name" className="block text-[14px] font-medium text-ink-700">
          {t("Tên chỗ nghỉ")}
        </label>
        <input
          id="name"
          name="name"
          required
          placeholder={t("An Bàng Villa")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="address" className="block text-[14px] font-medium text-ink-700">
          {t("Địa chỉ")} <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
        </label>
        <input
          id="address"
          name="address"
          defaultValue=""
          placeholder={t("Hội An, Đà Nẵng")}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="rooms" className="block text-[14px] font-medium text-ink-700">
          {t("Phòng")}
        </label>
        <textarea
          id="rooms"
          name="rooms"
          rows={5}
          required
          defaultValue=""
          placeholder={"Garden Suite\nSky Loft\nBamboo Room"}
          aria-describedby="rooms-hint"
          className={inputClass + " min-h-32 py-2.5"}
        />
        <p id="rooms-hint" className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          {t("Mỗi dòng một phòng. Nếu cho thuê nguyên căn, viết một dòng duy nhất — cả căn villa là một phòng.")}
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Submit />
        <Link
          href="/cho-nghi"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium text-ink-600 hover:text-ink-900"
        >
          {t("Hủy")}
        </Link>
      </div>
    </form>
  );
}
