"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { AmenityPicker } from "@/components/AmenityPicker";
import { useT } from "@/components/I18nProvider";
import {
  DEFAULT_PROPERTY_AMENITIES,
  DEFAULT_ROOM_AMENITIES,
} from "@/lib/amenities";
import { COUNTRIES } from "@/lib/countries";
import { CURRENCIES } from "@/lib/currencies";
import { fill } from "@/lib/i18n";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";

import type { PropertyState } from "../actions";

/**
 * Adding a property, in five steps.
 *
 * The shape — full-bleed panel, numbered rail down the left, one question area,
 * a footer that only ever offers back and forward — is taken from the design
 * the host asked to match. The colours are not: they are this product's own,
 * as asked for separately.
 *
 * It is a route rather than a modal. Visually there is no difference, because
 * the panel covers the viewport either way, but the URL is real: the back
 * button leaves the wizard instead of the page behind it, a half-filled form
 * survives a reload of the tab, and nobody has to find a close button to
 * escape.
 *
 * Every step is client state and there is exactly one submit, at the end. That
 * is what makes "review and create" mean something rather than decorate: until
 * the last button nothing is written, so backing up to change an answer costs
 * nothing and leaves nothing behind.
 */

const STEP_COUNT = 5;

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

const labelClass = "block text-[14px] font-medium text-ink-700";

const textareaClass =
  "mt-1.5 block w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[16px] leading-relaxed text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-[13px] text-ink-500">{hint}</p> : null}
    </div>
  );
}

function Chevron({ back = false }: { back?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={back ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
    </svg>
  );
}

function Create() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? t("Đang tạo…") : t("Tạo cơ sở")}
    </button>
  );
}

type Draft = {
  name: string;
  type: string;
  currency: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  roomName: string;
  roomDescription: string;
  roomCount: string;
  basePrice: string;
  maxAdults: string;
  maxChildren: string;
  intro: string;
  houseRules: string;
};

export function PropertyWizard({
  action,
  lang,
}: {
  action: (prev: PropertyState, formData: FormData) => Promise<PropertyState>;
  lang: "vi" | "en";
}) {
  const t = useT();
  const router = useRouter();
  const [state, formAction] = useActionState<PropertyState, FormData>(action, {
    error: null,
  });

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    type: "HOTEL",
    currency: "VND",
    addressLine1: "",
    addressLine2: "",
    city: "",
    region: "",
    postalCode: "",
    countryCode: "VN",
    roomName: "",
    roomDescription: "",
    roomCount: "1",
    basePrice: "",
    maxAdults: "2",
    maxChildren: "0",
    intro: "",
    houseRules: t("Nhận phòng sau 14:00\nTrả phòng trước 11:00"),
  });
  const [propertyAmenities, setPropertyAmenities] = useState<string[]>(
    DEFAULT_PROPERTY_AMENITIES,
  );
  const [roomAmenities, setRoomAmenities] = useState<string[]>(
    DEFAULT_ROOM_AMENITIES,
  );
  const [addressQuery, setAddressQuery] = useState("");

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((was) => ({ ...was, [key]: value }));

  const steps = [
    t("Thông tin cơ sở"),
    t("Phòng đầu tiên và giá"),
    t("Tiện nghi"),
    t("Mô tả và chính sách"),
    t("Xem lại và tạo"),
  ];

  /**
   * Split a pasted address into the boxes below it.
   *
   * The design this follows has a map search here. There is no geocoder behind
   * this app and pretending otherwise would be a box that looks like it does
   * something and does not, so it does the part that needs no map: an address
   * typed the way Vietnamese addresses are written — street, ward, city,
   * province — is already delimited, and the commas say where.
   */
  const applyAddressQuery = () => {
    const parts = addressQuery
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "");
    if (parts.length === 0) return;
    setDraft((was) => {
      if (parts.length < 3) {
        return {
          ...was,
          addressLine1: parts[0] ?? was.addressLine1,
          city: parts[1] ?? was.city,
        };
      }
      // Last is the province and second-to-last the city. Everything before
      // them stays on the street line rather than being dropped: a Vietnamese
      // address usually names a ward between the street and the city, and
      // "12 Trần Phú, Cẩm An" is how that address is written.
      return {
        ...was,
        addressLine1: parts.slice(0, -2).join(", "),
        city: parts[parts.length - 2]!,
        region: parts[parts.length - 1]!,
      };
    });
    setAddressQuery("");
  };

  const roomCount = Math.max(1, Math.min(200, Number(draft.roomCount) || 1));
  const adults = Math.max(1, Number(draft.maxAdults) || 1);
  const children = Math.max(0, Number(draft.maxChildren) || 0);

  // Checked here only to disable the button. The action re-checks all of it —
  // this is a courtesy, not a boundary.
  const canContinue =
    step === 1
      ? draft.name.trim() !== "" &&
        draft.addressLine1.trim() !== "" &&
        draft.city.trim() !== ""
      : step === 2
        ? draft.roomName.trim() !== "" && Number(draft.roomCount) >= 1
        : true;

  const addressLine = [
    draft.addressLine1,
    draft.addressLine2,
    draft.city,
    draft.region,
    draft.postalCode,
  ]
    .map((p) => p.trim())
    .filter((p) => p !== "")
    .join(", ");

  const currency = CURRENCIES.find((c) => c.code === draft.currency);

  return (
    <form
      action={formAction}
      className="fixed inset-0 z-50 flex flex-col bg-canvas"
    >
      {/* Everything the wizard has collected travels as hidden fields, so the
          steps you are not looking at still submit. */}
      {(Object.keys(draft) as (keyof Draft)[]).map((key) => (
        <input key={key} type="hidden" name={key} value={draft[key]} />
      ))}
      <input
        type="hidden"
        name="propertyAmenities"
        value={JSON.stringify(propertyAmenities)}
      />
      <input
        type="hidden"
        name="roomAmenities"
        value={JSON.stringify(roomAmenities)}
      />

      {/* ---- header ------------------------------------------------------ */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-line px-5">
        <span
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-lg bg-clay-100 text-brand"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 10h.01M15 10h.01M9 13h.01M15 13h.01" />
          </svg>
        </span>
        <h1 className="text-[15px] font-semibold text-ink-900">
          {t("Thêm cơ sở")}
        </h1>
        <button
          type="button"
          onClick={() => router.push("/cho-nghi")}
          aria-label={t("Đóng")}
          className="ml-auto grid size-9 place-items-center rounded-full text-ink-500 hover:bg-sand-100 hover:text-ink-900"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---- step rail ------------------------------------------------- */}
        <nav
          aria-label={t("Các bước")}
          className="hidden w-[280px] shrink-0 overflow-y-auto border-r border-line px-6 py-6 lg:block"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {t("Cơ sở mới")}
          </p>
          <ol className="mt-5">
            {steps.map((label, i) => {
              const n = i + 1;
              const done = n < step;
              const current = n === step;
              return (
                <li key={label} className="relative flex items-center gap-3 py-2.5">
                  {n < STEP_COUNT ? (
                    <span
                      aria-hidden="true"
                      className="absolute left-[13px] top-[38px] h-[18px] w-px bg-line"
                    />
                  ) : null}
                  <span
                    aria-hidden="true"
                    className={`grid size-[27px] shrink-0 place-items-center rounded-full text-[12px] font-semibold ${
                      done
                        ? "bg-brand text-white"
                        : current
                          ? "border-2 border-brand text-brand"
                          : "border border-line-strong text-ink-400"
                    }`}
                  >
                    {done ? (
                      <svg
                        viewBox="0 0 24 24"
                        className="size-3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m5 13 4 4L19 7" />
                      </svg>
                    ) : (
                      n
                    )}
                  </span>
                  <span
                    aria-current={current ? "step" : undefined}
                    className={`text-[14px] ${
                      current
                        ? "font-semibold text-ink-900"
                        : done
                          ? "text-ink-700"
                          : "text-ink-400"
                    }`}
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* ---- the question ---------------------------------------------- */}
        <div className="min-w-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8">
          <div className="mx-auto max-w-[640px]">
            <p className="text-[13px] text-ink-500 tnum">
              {fill(t("{n} / {tong}"), { n: step, tong: STEP_COUNT })}
            </p>
            <h2 className="mt-1 text-[26px] font-semibold tracking-tight text-ink-900">
              {steps[step - 1]}
            </h2>

            {state.error ? (
              <p
                role="alert"
                tabIndex={-1}
                className="mt-5 rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
              >
                {t(state.error)}
              </p>
            ) : null}

            {/* ---- 1. the property --------------------------------------- */}
            {step === 1 ? (
              <div className="mt-6 space-y-5">
                <Field id="w-name" label={t("Tên cơ sở")}>
                  <input
                    id="w-name"
                    value={draft.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder={t("Homestay Vườn Hội An")}
                    className={inputClass}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="w-type" label={t("Loại hình")}>
                    <select
                      id="w-type"
                      value={draft.type}
                      onChange={(e) => set("type", e.target.value)}
                      className={inputClass}
                    >
                      {PROPERTY_TYPES.map((key) => (
                        <option key={key} value={key}>
                          {t(PROPERTY_TYPE_LABELS[key])}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="w-currency" label={t("Tiền tệ")}>
                    <select
                      id="w-currency"
                      value={draft.currency}
                      onChange={(e) => set("currency", e.target.value)}
                      className={inputClass}
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field
                  id="w-address-search"
                  label={t("Tìm địa chỉ cơ sở")}
                  hint={t("Dán cả địa chỉ rồi nhấn Enter — các ô bên dưới tự điền theo dấu phẩy.")}
                >
                  <div className="relative">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-400"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    >
                      <circle cx="11" cy="11" r="7" />
                      <path d="m20 20-3.5-3.5" />
                    </svg>
                    <input
                      id="w-address-search"
                      value={addressQuery}
                      onChange={(e) => setAddressQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        // Enter in a one-field step would otherwise submit the
                        // form from step 1 — four steps early.
                        e.preventDefault();
                        applyAddressQuery();
                      }}
                      onBlur={applyAddressQuery}
                      placeholder={t("Nhập địa chỉ, tên đường hoặc thành phố")}
                      className={`${inputClass} pl-10`}
                    />
                  </div>
                </Field>

                <Field id="w-line1" label={t("Số nhà và tên đường")}>
                  <input
                    id="w-line1"
                    value={draft.addressLine1}
                    onChange={(e) => set("addressLine1", e.target.value)}
                    placeholder={t("12 Trần Phú")}
                    className={inputClass}
                  />
                </Field>

                <Field
                  id="w-line2"
                  label={t("Tòa nhà, tầng, căn (không bắt buộc)")}
                >
                  <input
                    id="w-line2"
                    value={draft.addressLine2}
                    onChange={(e) => set("addressLine2", e.target.value)}
                    placeholder={t("Tên tòa nhà, tầng, căn")}
                    className={inputClass}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="w-city" label={t("Thành phố")}>
                    <input
                      id="w-city"
                      value={draft.city}
                      onChange={(e) => set("city", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field id="w-region" label={t("Tỉnh / thành / khu vực")}>
                    <input
                      id="w-region"
                      value={draft.region}
                      onChange={(e) => set("region", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="w-postal" label={t("Mã bưu chính")}>
                    <input
                      id="w-postal"
                      value={draft.postalCode}
                      onChange={(e) => set("postalCode", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field id="w-country" label={t("Quốc gia / khu vực")}>
                    <select
                      id="w-country"
                      value={draft.countryCode}
                      onChange={(e) => set("countryCode", e.target.value)}
                      className={inputClass}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c[lang]}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            ) : null}

            {/* ---- 2. the first room ------------------------------------- */}
            {step === 2 ? (
              <div className="mt-6 space-y-5">
                <Field id="w-room-name" label={t("Tên loại phòng")}>
                  <input
                    id="w-room-name"
                    value={draft.roomName}
                    onChange={(e) => set("roomName", e.target.value)}
                    placeholder={t("Phòng Tiêu chuẩn")}
                    className={inputClass}
                  />
                </Field>

                <Field id="w-room-desc" label={t("Mô tả phòng")}>
                  <textarea
                    id="w-room-desc"
                    rows={4}
                    value={draft.roomDescription}
                    onChange={(e) => set("roomDescription", e.target.value)}
                    placeholder={t("Mô tả phòng, giường, tầm nhìn, sự riêng tư và phòng tắm.")}
                    className={textareaClass}
                  />
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    id="w-room-count"
                    label={t("Số lượng phòng")}
                    hint={
                      roomCount > 1
                        ? fill(
                            t("Tạo {n} phòng, đánh số từ 1 đến {n}. Đổi tên từng phòng được sau."),
                            { n: roomCount },
                          )
                        : t("Cho thuê nguyên căn thì để 1 — cả căn là một phòng.")
                    }
                  >
                    <input
                      id="w-room-count"
                      type="number"
                      min={1}
                      max={200}
                      value={draft.roomCount}
                      onChange={(e) => set("roomCount", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field id="w-price" label={t("Giá mỗi đêm")}>
                    <div className="relative">
                      <input
                        id="w-price"
                        type="number"
                        min={0}
                        step={1000}
                        value={draft.basePrice}
                        onChange={(e) => set("basePrice", e.target.value)}
                        className={`${inputClass} pr-16`}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 border-l border-line pl-3 text-[13px] text-ink-500"
                      >
                        {draft.currency}
                      </span>
                    </div>
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field id="w-adults" label={t("Tối đa người lớn")}>
                    <input
                      id="w-adults"
                      type="number"
                      min={1}
                      max={30}
                      value={draft.maxAdults}
                      onChange={(e) => set("maxAdults", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field id="w-children" label={t("Tối đa trẻ em")}>
                    <input
                      id="w-children"
                      type="number"
                      min={0}
                      max={30}
                      value={draft.maxChildren}
                      onChange={(e) => set("maxChildren", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>

                <p className="text-[13px] leading-relaxed text-ink-500">
                  {fill(t("Sức chứa mỗi phòng: {n} khách. Để trống giá cũng được — phòng vẫn nhận đặt, chỉ là khách không thấy con số nào."), {
                    n: adults + children,
                  })}
                </p>
              </div>
            ) : null}

            {/* ---- 3. amenities ------------------------------------------ */}
            {step === 3 ? (
              <div className="mt-6 space-y-7">
                <AmenityPicker
                  label={t("Tiện nghi cơ sở")}
                  scope="property"
                  lang={lang}
                  selected={propertyAmenities}
                  onChange={setPropertyAmenities}
                />
                <AmenityPicker
                  label={t("Tiện nghi phòng đầu tiên")}
                  scope="room"
                  lang={lang}
                  selected={roomAmenities}
                  onChange={setRoomAmenities}
                />
              </div>
            ) : null}

            {/* ---- 4. what a guest reads --------------------------------- */}
            {step === 4 ? (
              <div className="mt-6 space-y-5">
                <Field
                  id="w-intro"
                  label={t("Mô tả listing")}
                  hint={t("Hiện trên trang đặt phòng, ngay dưới tên cơ sở. Không bắt buộc.")}
                >
                  <textarea
                    id="w-intro"
                    rows={6}
                    value={draft.intro}
                    onChange={(e) => set("intro", e.target.value)}
                    placeholder={t("Mô tả không gian, khu vực xung quanh, trải nghiệm của khách và điểm đặc biệt của chỗ nghỉ.")}
                    className={textareaClass}
                  />
                </Field>

                <Field
                  id="w-rules"
                  label={t("Nội quy lưu trú")}
                  hint={t("Mỗi dòng một điều. Khách đọc đúng như bạn viết.")}
                >
                  <textarea
                    id="w-rules"
                    rows={6}
                    value={draft.houseRules}
                    onChange={(e) => set("houseRules", e.target.value)}
                    className={textareaClass}
                  />
                </Field>
              </div>
            ) : null}

            {/* ---- 5. review --------------------------------------------- */}
            {step === 5 ? (
              <div className="mt-6 space-y-4">
                <div className="card px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-ink-900">
                        {draft.name}
                      </p>
                      <p className="mt-0.5 text-[13px] text-ink-500">
                        {t(
                          PROPERTY_TYPE_LABELS[
                            draft.type as keyof typeof PROPERTY_TYPE_LABELS
                          ],
                        )}
                        {" · "}
                        {draft.currency}
                      </p>
                    </div>
                    <EditStep to={1} onGo={setStep} label={t("Sửa thông tin cơ sở")} />
                  </div>
                  <p className="mt-3 text-[14px] text-ink-700">
                    {addressLine}
                    {draft.countryCode ? `, ${draft.countryCode}` : ""}
                  </p>
                </div>

                <dl className="card divide-y divide-line">
                  <ReviewRow
                    label={t("Phòng đầu tiên")}
                    value={draft.roomName}
                    to={2}
                    onGo={setStep}
                    editLabel={t("Sửa phòng đầu tiên")}
                  />
                  <ReviewRow
                    label={fill(t("{n} phòng"), { n: roomCount })}
                    value={
                      draft.basePrice.trim() === ""
                        ? t("chưa đặt giá")
                        : fill(t("{gia} / đêm"), {
                            gia: `${Number(draft.basePrice).toLocaleString(
                              lang === "en" ? "en-US" : "vi-VN",
                            )} ${currency?.symbol ?? draft.currency}`,
                          })
                    }
                  />
                  <ReviewRow
                    label={t("Sức chứa mỗi phòng")}
                    value={fill(t("{nl} người lớn · {te} trẻ em"), {
                      nl: adults,
                      te: children,
                    })}
                  />
                  <ReviewRow
                    label={t("Tiện nghi cơ sở / phòng")}
                    value={`${propertyAmenities.length} / ${roomAmenities.length}`}
                    to={3}
                    onGo={setStep}
                    editLabel={t("Sửa tiện nghi")}
                  />
                  <ReviewRow
                    label={t("Nội quy")}
                    value={String(
                      draft.houseRules.split("\n").filter((l) => l.trim() !== "").length,
                    )}
                    to={4}
                    onGo={setStep}
                    editLabel={t("Sửa mô tả và chính sách")}
                  />
                </dl>

                <p className="text-[13px] leading-relaxed text-ink-500">
                  {t("Tạo xong, cơ sở hiện ngay trên lịch. Trang đặt phòng cho khách vẫn tắt cho tới khi bạn bật.")}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* ---- footer ------------------------------------------------------ */}
      <footer className="flex h-[76px] shrink-0 items-center gap-3 border-t border-line px-5">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((n) => n - 1)}
            className="inline-flex h-11 items-center gap-1.5 rounded-full border border-line px-5 text-[14px] font-medium text-ink-700 hover:bg-sand-100"
          >
            <Chevron back />
            {t("Quay lại")}
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push("/cho-nghi")}
            className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
          >
            {t("Đóng")}
          </button>

          {step < STEP_COUNT ? (
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => setStep((n) => n + 1)}
              className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand px-6 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-40"
            >
              {t("Tiếp tục")}
              <Chevron />
            </button>
          ) : (
            <Create />
          )}
        </div>
      </footer>
    </form>
  );
}

function EditStep({
  to,
  onGo,
  label,
}: {
  to: number;
  onGo: (n: number) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onGo(to)}
      aria-label={label}
      className="grid size-8 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-sand-100 hover:text-ink-900"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      </svg>
    </button>
  );
}

function ReviewRow({
  label,
  value,
  to,
  onGo,
  editLabel,
}: {
  label: string;
  value: string;
  to?: number;
  onGo?: (n: number) => void;
  editLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="text-[13.5px] text-ink-500">{label}</dt>
      <dd className="flex items-center gap-1 text-right text-[14px] font-medium text-ink-900">
        <span className="tnum">{value}</span>
        {to && onGo && editLabel ? (
          <EditStep to={to} onGo={onGo} label={editLabel} />
        ) : (
          <span aria-hidden="true" className="size-8" />
        )}
      </dd>
    </div>
  );
}
