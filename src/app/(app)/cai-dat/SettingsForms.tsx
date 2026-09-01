"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { TIMEZONES } from "@/lib/timezones";

import type { SettingsState } from "./actions";
import { useT } from "@/components/I18nProvider";

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

function Submit({ label }: { label?: string }) {
  const t = useT();
  const { pending } = useFormStatus();
  // Not a default parameter: the fallback comes from a hook, and a default
  // cannot call one.
  const text = label ?? t("Lưu");
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? t("Đang lưu…") : text}
    </button>
  );
}

/** The alert/status pair every form here shares. */
function Feedback({ state }: { state: SettingsState }) {
  const t = useT();

  if (state.error) {
    return (
      <p
        role="alert"
        tabIndex={-1}
        className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
      >
        {t(state.error)}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p
        role="status"
        className="rounded-xl border border-positive/25 bg-positive-soft px-4 py-3 text-[14px] text-positive"
      >
        {t(state.notice)}
      </p>
    );
  }
  return null;
}

export function OrgForm({
  action,
  name,
  timezone,
}: {
  action: Action;
  name: string;
  timezone: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <Feedback state={state} />

      <div>
        <label htmlFor="orgName" className="block text-[14px] font-medium text-ink-700">
          {t("Tên doanh nghiệp")}
        </label>
        <input
          id="orgName"
          name="name"
          required
          defaultValue={name}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="timezone" className="block text-[14px] font-medium text-ink-700">
          {t("Múi giờ")}
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={timezone}
          aria-describedby="tz-hint"
          className={inputClass}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <p id="tz-hint" className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          {t("Quyết định “hôm nay” là ngày nào trên lịch và bảng buồng phòng. Đổi múi giờ có thể làm một phòng chuyển sang cần dọn sớm hoặc muộn hơn một ngày.")}
        </p>
      </div>

      <Submit />
    </form>
  );
}

export function ProfileForm({ action, name }: { action: Action; name: string }) {
  const t = useT();
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <Feedback state={state} />

      <div>
        <label htmlFor="userName" className="block text-[14px] font-medium text-ink-700">
          {t("Tên của bạn")}
        </label>
        <input
          id="userName"
          name="name"
          required
          defaultValue={name}
          autoComplete="name"
          aria-describedby="name-hint"
          className={inputClass}
        />
        <p id="name-hint" className="mt-1.5 text-[13px] text-ink-500">
          {t("Tên này hiện bên cạnh mỗi đặt phòng và mỗi lần dọn phòng bạn ghi nhận.")}
        </p>
      </div>

      <Submit />
    </form>
  );
}

export function PasswordForm({ action }: { action: Action }) {
  const t = useT();
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {
    error: null,
  });

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      <Feedback state={state} />

      <div>
        <label htmlFor="current" className="block text-[14px] font-medium text-ink-700">
          {t("Mật khẩu hiện tại")}
        </label>
        <input
          id="current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="next" className="block text-[14px] font-medium text-ink-700">
          {t("Mật khẩu mới")}
        </label>
        <input
          id="next"
          name="next"
          type="password"
          required
          autoComplete="new-password"
          aria-describedby="next-hint"
          className={inputClass}
        />
        <p id="next-hint" className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          {t("Ít nhất 12 ký tự. Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác — phiên bạn đang dùng vẫn giữ nguyên.")}
        </p>
      </div>

      <Submit label={t("Đổi mật khẩu")} />
    </form>
  );
}
