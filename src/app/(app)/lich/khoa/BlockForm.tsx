"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { BlockState } from "../actions";
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
      {pending ? t("Đang lưu…") : t("Khóa những đêm này")}
    </button>
  );
}

export function BlockForm({
  action,
  rooms,
  defaultRoomId,
  defaultFrom,
  defaultTo,
}: {
  action: (prev: BlockState, formData: FormData) => Promise<BlockState>;
  rooms: { id: string; name: string; propertyName: string }[];
  defaultRoomId: string;
  defaultFrom: string;
  defaultTo: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState<BlockState, FormData>(action, {
    error: null,
  });

  const [from, setFrom] = useState(defaultFrom);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
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
        <label htmlFor="roomId" className="block text-[14px] font-medium text-ink-700">
          {t("Phòng")}
        </label>
        <select id="roomId" name="roomId" defaultValue={defaultRoomId} className={inputClass}>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.propertyName} — {r.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dateFrom" className="block text-[14px] font-medium text-ink-700">
            {t("Từ ngày")}
          </label>
          <input
            id="dateFrom"
            name="dateFrom"
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="dateTo" className="block text-[14px] font-medium text-ink-700">
            {t("Đến ngày")}
          </label>
          <input
            id="dateTo"
            name="dateTo"
            type="date"
            required
            min={from}
            defaultValue={defaultTo}
            aria-describedby="to-hint"
            className={inputClass}
          />
          {/* Same half-open rule as a booking, said in the words that fit a
              block: the end date is the morning the room is free again. */}
          <p id="to-hint" className="mt-1.5 text-[13px] text-ink-500">
            {t("Đêm cuối bị khóa là đêm trước ngày này.")}
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="block text-[14px] font-medium text-ink-700">
          {t("Lý do")}
        </label>
        <select id="reason" name="reason" defaultValue="MAINTENANCE" className={inputClass}>
          <option value="MAINTENANCE">{t("Bảo trì")}</option>
          <option value="OWNER_STAY">{t("Chủ nhà ở")}</option>
          <option value="OTHER">{t("Lý do khác")}</option>
        </select>
      </div>

      <div>
        <label htmlFor="note" className="block text-[14px] font-medium text-ink-700">
          {t("Ghi chú")} <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
        </label>
        <input id="note" name="note" defaultValue="" className={inputClass} />
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Submit />
        <Link
          href="/lich"
          className="inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-medium text-ink-600 hover:text-ink-900"
        >
          {t("Hủy")}
        </Link>
      </div>
    </form>
  );
}
