"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/I18nProvider";
import { fill } from "@/lib/i18n";

import type { DeleteState } from "./actions";

/**
 * The one control in the product that destroys a revenue record.
 *
 * It is closed by default, it lists what goes before it goes, and it wants
 * the property's name typed out. None of that is friction for its own sake:
 * the counts come from the page's own query, so a host reading "1 lượt đặt"
 * is reading a real row, and typing the name is the only confirmation that
 * cannot be given by a mis-aimed click.
 */

function Submit({ armed }: { armed: boolean }) {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || !armed}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-danger px-6 text-[15px] font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-40"
    >
      {pending ? t("Đang xóa…") : t("Xóa vĩnh viễn")}
    </button>
  );
}

export function DeletePropertyForm({
  action,
  propertyId,
  name,
  rooms,
  bookings,
  upcoming,
}: {
  action: (prev: DeleteState, formData: FormData) => Promise<DeleteState>;
  propertyId: string;
  name: string;
  rooms: number;
  bookings: number;
  /** Bookings that have not checked out yet. */
  upcoming: number;
}) {
  const t = useT();
  const [state, formAction] = useActionState<DeleteState, FormData>(action, {
    error: null,
  });
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-full border border-danger/40 px-5 text-[14px] font-medium text-danger hover:bg-danger-soft"
      >
        {t("Xóa cơ sở này")}
      </button>
    );
  }

  return (
    <form action={formAction} className="max-w-xl">
      <input type="hidden" name="propertyId" value={propertyId} />

      <p className="text-[14px] leading-relaxed text-ink-700">
        {t("Xóa xong không lấy lại được. Những thứ sau đây mất cùng cơ sở:")}
      </p>
      <ul className="mt-2 space-y-1 text-[14px] text-ink-700">
        <li>· {fill(t("{n} phòng"), { n: rooms })}</li>
        <li>
          · {fill(t("{n} lượt đặt"), { n: bookings })}
          {upcoming > 0 ? (
            <span className="font-semibold text-danger">
              {" "}
              {fill(t("— trong đó {n} lượt chưa trả phòng"), { n: upcoming })}
            </span>
          ) : null}
        </li>
      </ul>

      {upcoming > 0 ? (
        <p className="mt-3 rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-[13.5px] leading-relaxed text-warning">
          {t("Có khách đang ở hoặc sắp đến. Báo cho họ trước khi xóa — lịch của bạn sẽ không còn chỗ nào để nhắc bạn về họ.")}
        </p>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="mt-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {t(state.error)}
        </p>
      ) : null}

      <label
        htmlFor="confirm-name"
        className="mt-4 block text-[14px] font-medium text-ink-700"
      >
        {fill(t("Gõ “{ten}” để xác nhận"), { ten: name })}
      </label>
      <input
        id="confirm-name"
        name="confirmName"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className="mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-danger focus-visible:ring-2 focus-visible:ring-danger/20"
      />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Checked here only to arm the button. The action compares the typed
            name against the one in the database, which is the check that
            counts — this one just stops the button looking ready when it is
            not. */}
        <Submit armed={typed.trim() === name} />
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
        >
          {t("Hủy")}
        </button>
      </div>
    </form>
  );
}
