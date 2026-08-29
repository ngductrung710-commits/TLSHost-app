"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  THEMES,
  THEME_LABELS,
  brandColorProblem,
  themeVars,
  type BookingTheme,
} from "@/lib/themes";

import type { SettingsState } from "./actions";
import { useT } from "@/components/I18nProvider";

type Action = (prev: SettingsState, formData: FormData) => Promise<SettingsState>;

const ORDER: BookingTheme[] = ["CLASSIC", "MINIMAL", "WARM", "BOLD"];

function Submit() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
    >
      {pending ? t("Đang lưu…") : t("Lưu giao diện")}
    </button>
  );
}

/** A miniature of the booking page, drawn in the theme it represents. */
function Swatch({
  theme,
  brandColor,
  selected,
}: {
  theme: BookingTheme;
  brandColor: string | null;
  selected: boolean;
}) {
  const vars = themeVars(theme, selected ? brandColor : null);
  const t = THEMES[theme];

  return (
    <span
      aria-hidden="true"
      style={vars as React.CSSProperties}
      className="block overflow-hidden rounded-xl border border-line"
    >
      <span className="block bg-[var(--bg)] p-3">
        <span
          className="block bg-[var(--surface)] p-2.5"
          style={{ borderRadius: "calc(var(--radius) * 0.6)" }}
        >
          <span className="block h-1.5 w-2/3 rounded-full bg-[var(--ink)] opacity-90" />
          <span className="mt-1.5 block h-1 w-1/2 rounded-full bg-[var(--ink-soft)] opacity-70" />
          <span
            className="mt-2.5 block h-4 w-16 bg-[var(--accent)]"
            style={{ borderRadius: "999px" }}
          />
        </span>
      </span>
      <span className="sr-only">{t.bg}</span>
    </span>
  );
}

export function AppearanceForm({
  action,
  bookingTheme,
  brandColor,
}: {
  action: Action;
  bookingTheme: BookingTheme;
  brandColor: string | null;
}) {
  const t = useT();
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {
    error: null,
  });

  const [theme, setTheme] = useState<BookingTheme>(bookingTheme);
  const [color, setColor] = useState(brandColor ?? "");

  // The same function the server runs, so the warning a host sees while typing
  // is the reason the save would be refused rather than a guess at it.
  const problem = color.trim() === "" ? null : brandColorProblem(color, theme);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] leading-relaxed text-danger"
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

      <fieldset>
        <legend className="text-[14px] font-medium text-ink-700">
          {t("Phong cách")}
        </legend>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
          {t("Áp dụng cho trang đặt phòng của mọi chỗ nghỉ. Bốn phong cách này đều đã được kiểm tra độ tương phản, nên khách luôn đọc được.")}
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          {ORDER.map((option) => (
            <label
              key={option}
              className={`cursor-pointer rounded-2xl border p-2 transition-colors ${
                theme === option
                  ? "border-ink-900 bg-sand-50"
                  : "border-line hover:border-ink-300"
              }`}
            >
              <input
                type="radio"
                name="bookingTheme"
                value={option}
                checked={theme === option}
                onChange={() => setTheme(option)}
                className="sr-only"
              />
              <Swatch
                theme={option}
                brandColor={color.trim() || null}
                selected={theme === option}
              />
              <span className="mt-2 block text-center text-[13px] font-medium text-ink-800">
                {t(THEME_LABELS[option])}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="brandColor" className="block text-[14px] font-medium text-ink-700">
          {t("Màu thương hiệu")}{" "}
          <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
        </label>
        <div className="mt-1.5 flex items-center gap-3">
          {/* A native colour picker and a text field over the same value: the
              picker is faster, the text field is the only way to paste the hex
              from a brand guide. */}
          <input
            type="color"
            aria-label={t("Chọn màu")}
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : THEMES[theme].accent}
            onChange={(e) => setColor(e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-xl border border-line-strong bg-white p-1"
          />
          <input
            id="brandColor"
            name="brandColor"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder={THEMES[theme].accent}
            aria-describedby="brand-hint"
            className="min-h-11 w-40 rounded-xl border border-line-strong bg-white px-3.5 font-mono text-[15px] text-ink-900"
          />
          {color.trim() !== "" ? (
            <button
              type="button"
              onClick={() => setColor("")}
              className="min-h-11 px-2 text-[13px] font-medium text-ink-500 hover:text-ink-900"
            >
              {t("Dùng màu mặc định")}
            </button>
          ) : null}
        </div>

        {problem ? (
          <p className="mt-2 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-warning">
            {problem}
          </p>
        ) : (
          <p id="brand-hint" className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
            {t("Dùng cho nút và điểm nhấn. Để trống thì lấy màu của phong cách. Màu quá nhạt sẽ bị từ chối — nút phải đọc được.")}
          </p>
        )}
      </div>

      <Submit />
    </form>
  );
}

export function LogoForm({
  action,
  removeAction,
  logoFile,
  orgName,
}: {
  action: Action;
  removeAction: () => Promise<void>;
  logoFile: string | null;
  orgName: string;
}) {
  const t = useT();
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {
    error: null,
  });

  return (
    <div className="max-w-2xl space-y-4">
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

      <div className="flex flex-wrap items-center gap-5">
        <span className="flex h-16 w-32 items-center justify-center rounded-xl border border-line bg-sand-50">
          {logoFile ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/tai-len/${logoFile}`}
              alt={orgName}
              className="max-h-12 max-w-28 object-contain"
            />
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-400">
              {t("Chưa có")}
            </span>
          )}
        </span>

        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            required
            aria-describedby="logo-hint"
            className="max-w-full text-[14px] file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:text-[14px] file:font-medium file:text-ink-700"
          />
          <button
            type="submit"
            className="min-h-11 rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 hover:bg-ink-800"
          >
            {t("Tải lên")}
          </button>
        </form>

        {logoFile ? (
          <form action={removeAction}>
            <button
              type="submit"
              className="min-h-11 px-3 text-[13px] font-medium text-danger hover:underline"
            >
              {t("Gỡ logo")}
            </button>
          </form>
        ) : null}
      </div>

      <p id="logo-hint" className="text-[13px] leading-relaxed text-ink-500">
        {t("PNG, JPEG hoặc WebP, tối đa 2 MB. Hiện ở đầu trang đặt phòng của khách. Không nhận SVG — định dạng đó chứa được mã, và trang này phục vụ người lạ.")}
      </p>
    </div>
  );
}
