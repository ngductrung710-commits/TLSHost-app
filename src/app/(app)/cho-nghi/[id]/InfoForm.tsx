"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { AmenityPicker } from "@/components/AmenityPicker";
import { useT } from "@/components/I18nProvider";
import { COUNTRIES } from "@/lib/countries";
import { PROPERTY_TYPES, PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";

import type { EditState } from "./actions";

/**
 * Sửa những gì wizard đã hỏi lúc tạo.
 *
 * Một form, một nút lưu, không tự lưu khi rời ô. Tự lưu ở đây sẽ ghi một địa
 * chỉ dở dang xuống cơ sở dữ liệu ngay giữa lúc gõ — và địa chỉ này là thứ
 * khách đọc trên trang đặt phòng.
 *
 * Giá trị ban đầu đặt bằng defaultValue chứ không phải value: React sẽ không
 * giữ chúng, trình duyệt giữ. Nghĩa là không có state nào phải đồng bộ, và
 * bấm "hoàn tác" của trình duyệt vẫn hoạt động như trên một form thường.
 */

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required = false,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div>
      <label htmlFor={name} className="block text-[14px] font-medium text-ink-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        aria-describedby={hintId}
        className="mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
      />
      {hint ? (
        <p id={hintId} className="mt-1.5 text-[13px] text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Save() {
  const t = useT();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? t("Đang lưu…") : t("Lưu thay đổi")}
    </button>
  );
}

export function InfoForm({
  action,
  locale,
  property,
}: {
  action: (prev: EditState, formData: FormData) => Promise<EditState>;
  locale: "vi" | "en";
  property: {
    id: string;
    name: string;
    type: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    countryCode: string | null;
    intro: string | null;
    houseRules: string | null;
    amenities: string[];
  };
}) {
  const t = useT();
  const [state, formAction] = useActionState<EditState, FormData>(action, {
    error: null,
  });
  const [amenities, setAmenities] = useState<string[]>(property.amenities);

  const inputClass =
    "mt-1.5 block w-full rounded-xl border border-line-strong bg-white px-3.5 py-2.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="propertyId" value={property.id} />
      <input type="hidden" name="propertyAmenities" value={JSON.stringify(amenities)} />

      {state.error ? (
        <p
          role="alert"
          tabIndex={-1}
          className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
        >
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p
          role="status"
          className="rounded-xl border border-positive/30 bg-positive-soft px-4 py-3 text-[14px] text-positive"
        >
          {state.notice}
        </p>
      ) : null}

      {/* ---- tên và loại hình --------------------------------------------- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            {t("Thông tin cơ bản")}
          </h2>
          <p className="mt-1 text-[14px] text-ink-600">
            {t("Tên và vị trí là những thứ khách nhìn thấy đầu tiên.")}
          </p>
        </div>

        <Field
          label={t("Tên cơ sở")}
          name="name"
          defaultValue={property.name}
          required
        />

        <div>
          <label htmlFor="type" className="block text-[14px] font-medium text-ink-700">
            {t("Loại hình")}
          </label>
          <select
            id="type"
            name="type"
            defaultValue={property.type ?? ""}
            className={inputClass}
          >
            <option value="">{t("Chưa chọn")}</option>
            {/* Nhãn loại hình là câu tiếng Việt và đi qua từ điển như mọi câu
                khác — khác với danh mục quốc gia và tiện nghi, vốn tự mang sẵn
                cả hai thứ tiếng trong chính tệp dữ liệu của chúng. */}
            {PROPERTY_TYPES.map((key) => (
              <option key={key} value={key}>
                {t(PROPERTY_TYPE_LABELS[key])}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* ---- địa chỉ ------------------------------------------------------ */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[1.125rem] font-semibold text-ink-900">{t("Vị trí")}</h2>
          <p className="mt-1 text-[14px] text-ink-600">
            {t("Địa chỉ này hiện trên trang đặt phòng và trong thư xác nhận gửi khách.")}
          </p>
        </div>

        <Field
          label={t("Số nhà và tên đường")}
          name="addressLine1"
          defaultValue={property.addressLine1 ?? ""}
          required
        />
        <Field
          label={t("Tòa nhà, tầng, căn")}
          name="addressLine2"
          defaultValue={property.addressLine2 ?? ""}
          hint={t("Không bắt buộc.")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("Thành phố")}
            name="city"
            defaultValue={property.city ?? ""}
            required
          />
          <Field
            label={t("Tỉnh / thành / khu vực")}
            name="region"
            defaultValue={property.region ?? ""}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("Mã bưu chính")}
            name="postalCode"
            defaultValue={property.postalCode ?? ""}
          />
          <div>
            <label
              htmlFor="countryCode"
              className="block text-[14px] font-medium text-ink-700"
            >
              {t("Quốc gia")}
            </label>
            <select
              id="countryCode"
              name="countryCode"
              defaultValue={property.countryCode ?? "VN"}
              className={inputClass}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c[locale]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ---- tiện nghi ---------------------------------------------------- */}
      <section>
        <AmenityPicker
          label={t("Tiện nghi cơ sở")}
          scope="property"
          lang={locale}
          selected={amenities}
          onChange={setAmenities}
        />
      </section>

      {/* ---- giới thiệu và nội quy ---------------------------------------- */}
      <section className="space-y-4">
        <div>
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            {t("Giới thiệu và nội quy")}
          </h2>
          <p className="mt-1 text-[14px] text-ink-600">
            {t("Mỗi dòng nội quy là một dòng riêng. Khách đọc chúng trước khi đặt.")}
          </p>
        </div>

        <div>
          <label htmlFor="intro" className="block text-[14px] font-medium text-ink-700">
            {t("Giới thiệu")}
          </label>
          <textarea
            id="intro"
            name="intro"
            rows={4}
            maxLength={600}
            defaultValue={property.intro ?? ""}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="houseRules"
            className="block text-[14px] font-medium text-ink-700"
          >
            {t("Nội quy lưu trú")}
          </label>
          <textarea
            id="houseRules"
            name="houseRules"
            rows={5}
            defaultValue={property.houseRules ?? ""}
            className={inputClass}
          />
        </div>
      </section>

      <Save />
    </form>
  );
}
