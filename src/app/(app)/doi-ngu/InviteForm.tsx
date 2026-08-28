"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { TeamState } from "./actions";

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? "Đang tạo…" : "Tạo lời mời"}
    </button>
  );
}

export function InviteForm({
  action,
  properties,
  origin,
}: {
  action: (prev: TeamState, formData: FormData) => Promise<TeamState>;
  properties: { id: string; name: string }[];
  /** Passed from the server so the copied link is absolute. */
  origin: string;
}) {
  const [state, formAction] = useActionState<TeamState, FormData>(action, {
    error: null,
  });

  // Only meaningful for a collaborator; a housekeeper never touches bookings.
  const [role, setRole] = useState("COLLABORATOR");

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {state.error}
        </p>
      ) : null}

      {state.inviteLink ? (
        <div
          role="status"
          className="rounded-xl border border-positive/25 bg-positive-soft px-4 py-3"
        >
          <p className="text-[14px] font-semibold text-positive">
            Lời mời đã tạo
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-600">
            Gửi link này cho họ. Link dùng được một lần, hết hạn sau 14 ngày.
          </p>
          {/* Selected on focus so one tap or Ctrl+A grabs the whole thing —
              these are long and easy to truncate by hand. readOnly rather than
              disabled so it can still be focused and copied. */}
          <input
            readOnly
            value={`${origin}${state.inviteLink}`}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-3 block w-full rounded-lg border border-line bg-white px-3 py-2 font-mono text-[12px] text-ink-700"
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-[14px] font-medium text-ink-700">
            Tên
          </label>
          <input id="name" name="name" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className="block text-[14px] font-medium text-ink-700">
            Email
          </label>
          <input id="email" name="email" type="email" required className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="role" className="block text-[14px] font-medium text-ink-700">
          Vai trò
        </label>
        <select
          id="role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-describedby="role-hint"
          className={inputClass}
        >
          <option value="COLLABORATOR">Cộng tác viên</option>
          <option value="HOUSEKEEPER">Dọn phòng</option>
        </select>
        <p id="role-hint" className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          {role === "COLLABORATOR"
            ? "Xem và quản lý đặt phòng ở những chỗ nghỉ bạn giao."
            : "Chỉ thấy phòng cần dọn. Không thấy giá phòng hay thông tin thanh toán của khách."}
        </p>
      </div>

      {role === "COLLABORATOR" ? (
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="canEditOthersBookings"
            className="mt-1 h-4 w-4 rounded border-line-strong"
          />
          <span className="text-[14px] leading-relaxed text-ink-700">
            Được sửa đặt phòng do người khác tạo
            <span className="mt-0.5 block text-[13px] text-ink-500">
              Bỏ trống thì họ chỉ sửa được những gì chính họ nhập.
            </span>
          </span>
        </label>
      ) : null}

      <fieldset>
        <legend className="text-[14px] font-medium text-ink-700">
          Chỗ nghỉ được giao
        </legend>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
          Không chọn gì nghĩa là tất cả chỗ nghỉ.
        </p>
        <div className="mt-3 space-y-2">
          {properties.map((p) => (
            <label key={p.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                name="propertyIds"
                value={p.id}
                className="h-4 w-4 rounded border-line-strong"
              />
              <span className="text-[14px] text-ink-700">{p.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="pt-1">
        <Submit />
      </div>
    </form>
  );
}
