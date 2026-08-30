"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { useT } from "@/components/I18nProvider";
import { fill } from "@/lib/i18n";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";

import type { PropertyState } from "../actions";

/**
 * Adding a property, in four steps.
 *
 * It replaces a single page with a name, an address and a textarea of room
 * names. That form worked, and it produced rooms with no capacity and no rate
 * — details that then needed a second visit to the property page, which is a
 * visit most people never make. A room with no rate shows a guest no price, so
 * the booking page it exists to feed is worse for it.
 *
 * The steps are client state and there is exactly one submit, at the end. That
 * is the difference between "review and create" meaning something and being
 * decoration: nothing is written until the last button, so backing up and
 * changing an answer costs nothing and leaves nothing behind.
 *
 * A route rather than the modal the design was taken from. The back button
 * works, the URL can be sent to someone, and the rail stays visible so nobody
 * has to find a close button to escape a half-finished form.
 */

type Room = { name: string; capacity: string; basePrice: string };

const STEP_COUNT = 4;

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

const labelClass = "block text-[14px] font-medium text-ink-700";

function Create() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? t("Đang tạo…") : t("Tạo chỗ nghỉ")}
    </button>
  );
}

export function PropertyWizard({
  action,
}: {
  action: (prev: PropertyState, formData: FormData) => Promise<PropertyState>;
}) {
  const t = useT();
  const [state, formAction] = useActionState<PropertyState, FormData>(action, {
    error: null,
  });

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [address, setAddress] = useState("");
  const [intro, setIntro] = useState("");
  const [rooms, setRooms] = useState<Room[]>([
    { name: "", capacity: "2", basePrice: "" },
  ]);

  const steps = [
    t("Thông tin cơ sở"),
    t("Phòng và giá"),
    t("Mô tả cho khách"),
    t("Xem lại và tạo"),
  ];

  const namedRooms = rooms.filter((room) => room.name.trim() !== "");

  // Checked here only to disable the button. The action re-checks everything —
  // this is a courtesy, not a boundary.
  const canContinue =
    step === 1 ? name.trim() !== "" : step === 2 ? namedRooms.length > 0 : true;

  const setRoom = (index: number, patch: Partial<Room>) =>
    setRooms((was) => was.map((room, i) => (i === index ? { ...room, ...patch } : room)));

  return (
    <form action={formAction} className="grid min-h-0 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Everything the wizard has collected travels as hidden fields, so the
          steps you are not looking at still submit. */}
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="address" value={address} />
      <input type="hidden" name="intro" value={intro} />
      <input
        type="hidden"
        name="rooms"
        value={JSON.stringify(
          namedRooms.map((room) => ({
            name: room.name.trim(),
            capacity: Number(room.capacity) || 2,
            basePrice: room.basePrice.trim(),
          })),
        )}
      />

      <ol className="hidden border-r border-line pr-6 lg:block" aria-label={t("Các bước")}>
        <li className="mb-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
          {t("Chỗ nghỉ mới")}
        </li>
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} className="flex items-center gap-3 py-2">
              <span
                aria-hidden="true"
                className={`grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                  current
                    ? "bg-brand text-white"
                    : done
                      ? "bg-clay-100 text-brand"
                      : "bg-sand-200 text-ink-500"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span
                className={`text-[14px] ${
                  current ? "font-semibold text-ink-900" : "text-ink-500"
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="lg:pl-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500 lg:hidden">
          {fill(t("Bước {n} / {tong}"), { n: step, tong: STEP_COUNT })}
        </p>
        <h2 className="mt-1 text-[16px] font-semibold text-ink-900 lg:mt-0">
          {steps[step - 1]}
        </h2>

        {state.error ? (
          <p
            role="alert"
            tabIndex={-1}
            className="mt-4 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
          >
            {t(state.error)}
          </p>
        ) : null}

        {/* ---- 1. the property -------------------------------------------- */}
        {step === 1 ? (
          <div className="mt-5 max-w-xl space-y-5">
            <div>
              <label htmlFor="w-name" className={labelClass}>
                {t("Tên chỗ nghỉ")}
              </label>
              <input
                id="w-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("An Bàng Villa")}
                className={inputClass}
              />
              <p className="mt-1.5 text-[13px] text-ink-500">
                {t("Tên bạn dùng để gọi chỗ nghỉ của mình. Đổi được sau.")}
              </p>
            </div>

            <div>
              <label htmlFor="w-type" className={labelClass}>
                {t("Loại hình")}
              </label>
              <select
                id="w-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={inputClass}
              >
                <option value="">{t("Chưa chọn")}</option>
                {PROPERTY_TYPES.map((key) => (
                  <option key={key} value={key}>
                    {t(PROPERTY_TYPE_LABELS[key])}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[13px] text-ink-500">
                {t("Hiện cạnh địa chỉ trên trang đặt phòng. Khách đọc “Homestay” và “Resort” với hai kỳ vọng khác nhau.")}
              </p>
            </div>

            <div>
              <label htmlFor="w-address" className={labelClass}>
                {t("Địa chỉ")}{" "}
                <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
              </label>
              <input
                id="w-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("Hội An, Đà Nẵng")}
                className={inputClass}
              />
            </div>
          </div>
        ) : null}

        {/* ---- 2. rooms ---------------------------------------------------- */}
        {step === 2 ? (
          <div className="mt-5 max-w-2xl">
            <p className="text-[13.5px] leading-relaxed text-ink-600">
              {t("Mỗi dòng một phòng. Nếu cho thuê nguyên căn, viết một dòng duy nhất — cả căn villa là một phòng.")}
            </p>

            <ul className="mt-4 space-y-3">
              {rooms.map((room, i) => (
                <li key={i} className="card flex flex-wrap items-end gap-3 p-4">
                  <div className="min-w-48 flex-1">
                    <label htmlFor={`room-${i}`} className={labelClass}>
                      {t("Tên phòng")}
                    </label>
                    <input
                      id={`room-${i}`}
                      value={room.name}
                      onChange={(e) => setRoom(i, { name: e.target.value })}
                      placeholder={t("Sky Loft")}
                      className={inputClass}
                    />
                  </div>
                  <div className="w-28">
                    <label htmlFor={`cap-${i}`} className={labelClass}>
                      {t("Số khách")}
                    </label>
                    <input
                      id={`cap-${i}`}
                      type="number"
                      min={1}
                      max={30}
                      value={room.capacity}
                      onChange={(e) => setRoom(i, { capacity: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="w-44">
                    <label htmlFor={`price-${i}`} className={labelClass}>
                      {t("Giá mỗi đêm (₫)")}
                    </label>
                    <input
                      id={`price-${i}`}
                      type="number"
                      min={0}
                      step={1000}
                      value={room.basePrice}
                      onChange={(e) => setRoom(i, { basePrice: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  {rooms.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setRooms((was) => was.filter((_, j) => j !== i))}
                      className="min-h-11 px-2 text-[13px] font-medium text-danger hover:underline"
                    >
                      {t("Xóa")}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() =>
                setRooms((was) => [...was, { name: "", capacity: "2", basePrice: "" }])
              }
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-[14px] font-medium text-ink-700 hover:bg-sand-50"
            >
              <span aria-hidden="true">+</span>
              {t("Thêm phòng")}
            </button>

            <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
              {t("Để trống giá cũng được — phòng vẫn nhận đặt, chỉ là khách không thấy con số nào.")}
            </p>
          </div>
        ) : null}

        {/* ---- 3. the description guests read ------------------------------ */}
        {step === 3 ? (
          <div className="mt-5 max-w-xl">
            <label htmlFor="w-intro" className={labelClass}>
              {t("Giới thiệu")}{" "}
              <span className="font-normal text-ink-500">{t("(không bắt buộc)")}</span>
            </label>
            <textarea
              id="w-intro"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={6}
              className="mt-1.5 block w-full rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-[16px] leading-relaxed text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
            />
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
              {t("Vài dòng khách đọc trước khi đặt. Không bắt buộc.")}
            </p>
          </div>
        ) : null}

        {/* ---- 4. review --------------------------------------------------- */}
        {step === 4 ? (
          <div className="mt-5 max-w-xl">
            <dl className="card divide-y divide-line">
              {[
                { key: "name", label: t("Tên chỗ nghỉ"), value: name },
                {
                  key: "type",
                  label: t("Loại hình"),
                  value: type
                    ? t(PROPERTY_TYPE_LABELS[type as keyof typeof PROPERTY_TYPE_LABELS])
                    : "—",
                },
                { key: "address", label: t("Địa chỉ"), value: address || "—" },
                {
                  key: "rooms",
                  label: t("Phòng"),
                  value: fill(t("{n} phòng"), { n: namedRooms.length }),
                },
                { key: "intro", label: t("Giới thiệu"), value: intro ? "✓" : "—" },
              ].map((row) => (
                <div key={row.key} className="flex justify-between gap-4 px-5 py-3">
                  <dt className="text-[13.5px] text-ink-500">{row.label}</dt>
                  <dd className="text-right text-[14px] font-medium text-ink-900">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>

            <ul className="mt-3 card divide-y divide-line">
              {namedRooms.map((room) => (
                <li
                  key={room.name}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="text-[14px] font-medium text-ink-900">
                    {room.name}
                  </span>
                  <span className="text-[13px] text-ink-500 tnum">
                    {fill(t("tối đa {n} khách"), { n: room.capacity })}
                    {room.basePrice.trim() !== ""
                      ? ` · ${Number(room.basePrice).toLocaleString("vi-VN")} ₫`
                      : ` · ${t("chưa đặt giá")}`}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[13px] leading-relaxed text-ink-500">
              {t("Tạo xong, chỗ nghỉ hiện ngay trên lịch. Trang đặt phòng cho khách vẫn tắt cho tới khi bạn bật.")}
            </p>
          </div>
        ) : null}

        {/* ---- footer ------------------------------------------------------ */}
        <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-5">
          {step === 1 ? (
            <Link
              href="/cho-nghi"
              className="inline-flex h-10 items-center rounded-full border border-line px-5 text-[14px] font-medium text-ink-700 hover:bg-sand-50"
            >
              {t("Hủy")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setStep((n) => n - 1)}
              className="inline-flex h-10 items-center rounded-full border border-line px-5 text-[14px] font-medium text-ink-700 hover:bg-sand-50"
            >
              {t("Quay lại")}
            </button>
          )}

          {step < STEP_COUNT ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep((n) => n + 1)}
              className="inline-flex h-10 items-center rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {t("Tiếp tục")}
            </button>
          ) : (
            <Create />
          )}
        </div>
      </div>
    </form>
  );
}
