"use client";

import { useState } from "react";

import { useT } from "@/components/I18nProvider";

/**
 * Khối Chính sách: hai mốc giờ, năm quy định ba trạng thái, giờ yên tĩnh,
 * ghi chú đặt cọc và quy định bổ sung.
 *
 * "Chưa đặt" là một lựa chọn có thật, không phải trạng thái rỗng — nên nó là
 * nút đầu tiên trong mỗi hàng chứ không phải chỗ rơi vào khi không bấm gì.
 * Sự khác nhau giữa "chưa trả lời" và "không cho phép" là sự khác nhau giữa
 * một khách phải nhắn hỏi và một khách không cần hỏi.
 */

type Choice = { value: string; label: string };

function Segmented({
  name,
  legend,
  icon,
  value,
  choices,
}: {
  name: string;
  legend: string;
  icon: string;
  value: string;
  choices: Choice[];
}) {
  const t = useT();
  const [picked, setPicked] = useState(value);

  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3">
      <legend className="sr-only">{legend}</legend>
      <span aria-hidden="true" className="flex items-center gap-2 text-[14px] text-ink-800">
        <span className="text-[15px]">{icon}</span>
        {legend}
      </span>

      {/* Radio thật, chỉ được vẽ khác đi. Một hàng <button> sẽ mất bàn phím,
          mất nhóm cho trình đọc màn hình, và mất luôn giá trị khi gửi form. */}
      <div className="flex overflow-hidden rounded-full border border-line-strong">
        {[{ value: "", label: t("Chưa đặt") }, ...choices].map((c) => {
          const on = picked === c.value;
          return (
            <label
              key={c.value || "unset"}
              className={`cursor-pointer px-3.5 py-2 text-[13px] font-medium transition-colors ${
                on ? "bg-ink-900 text-sand-100" : "text-ink-600 hover:bg-sand-100"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={c.value}
                checked={on}
                onChange={() => setPicked(c.value)}
                className="sr-only"
              />
              {c.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

export type PolicyValues = {
  checkInFrom: string | null;
  checkOutBy: string | null;
  smokingPolicy: string | null;
  petsPolicy: string | null;
  eventsPolicy: string | null;
  photographyPolicy: string | null;
  childrenPolicy: string | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
  depositNote: string | null;
};

export function PolicyFields({ value }: { value: PolicyValues }) {
  const t = useT();
  // Giờ yên tĩnh không có cờ riêng trong cơ sở dữ liệu: có hai mốc là bật.
  // Cờ ở đây chỉ để ẩn/hiện hai ô, và khi tắt thì hai ô rỗng được gửi lên —
  // nên trạng thái trên màn hình và trong bảng không bao giờ lệch nhau.
  const [quiet, setQuiet] = useState(
    value.quietHoursFrom !== null && value.quietHoursTo !== null,
  );

  return (
    <section className="space-y-1">
      <div className="mb-4">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">{t("Chính sách")}</h2>
        <p className="mt-1 text-[14px] text-ink-600">
          {t("Chọn nội quy tiêu chuẩn và thêm những điều khách cần biết trước khi đặt.")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="checkInFrom"
            className="block text-[14px] font-medium text-ink-700"
          >
            {t("Nhận phòng từ")}
          </label>
          <input
            id="checkInFrom"
            name="checkInFrom"
            type="time"
            defaultValue={value.checkInFrom ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="checkOutBy"
            className="block text-[14px] font-medium text-ink-700"
          >
            {t("Trả phòng trước")}
          </label>
          <input
            id="checkOutBy"
            name="checkOutBy"
            type="time"
            defaultValue={value.checkOutBy ?? ""}
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-2">
        <Segmented
          name="smokingPolicy"
          legend={t("Hút thuốc và vape")}
          icon="🚬"
          value={value.smokingPolicy ?? ""}
          choices={[
            { value: "ALLOWED", label: t("Cho phép") },
            { value: "NOT_ALLOWED", label: t("Không") },
          ]}
        />
        <Segmented
          name="petsPolicy"
          legend={t("Thú cưng")}
          icon="🐾"
          value={value.petsPolicy ?? ""}
          choices={[
            { value: "ALLOWED", label: t("Cho phép") },
            { value: "NOT_ALLOWED", label: t("Không") },
          ]}
        />
        <Segmented
          name="eventsPolicy"
          legend={t("Tiệc và sự kiện")}
          icon="🎉"
          value={value.eventsPolicy ?? ""}
          choices={[
            { value: "ON_REQUEST", label: t("Cần duyệt") },
            { value: "NOT_ALLOWED", label: t("Không") },
          ]}
        />
        <Segmented
          name="photographyPolicy"
          legend={t("Chụp ảnh thương mại")}
          icon="📷"
          value={value.photographyPolicy ?? ""}
          choices={[
            { value: "ON_REQUEST", label: t("Cần duyệt") },
            { value: "NOT_ALLOWED", label: t("Không") },
          ]}
        />
        <Segmented
          name="childrenPolicy"
          legend={t("Trẻ em và em bé")}
          icon="🧒"
          value={value.childrenPolicy ?? ""}
          choices={[
            { value: "SUITABLE", label: t("Phù hợp") },
            { value: "NOT_SUITABLE", label: t("Không phù hợp") },
          ]}
        />
      </div>

      <div className="border-t border-line py-3">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[14px] text-ink-800">
            <span aria-hidden="true" className="text-[15px]">
              🌙
            </span>
            {t("Giờ yên tĩnh")}
          </span>
          <input
            type="checkbox"
            checked={quiet}
            onChange={(e) => setQuiet(e.target.checked)}
            className="h-5 w-5 rounded border-line-strong accent-ink-900"
          />
        </label>

        {quiet ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="quietHoursFrom"
                className="block text-[14px] font-medium text-ink-700"
              >
                {t("Bắt đầu")}
              </label>
              <input
                id="quietHoursFrom"
                name="quietHoursFrom"
                type="time"
                defaultValue={value.quietHoursFrom ?? "22:00"}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="quietHoursTo"
                className="block text-[14px] font-medium text-ink-700"
              >
                {t("Kết thúc")}
              </label>
              <input
                id="quietHoursTo"
                name="quietHoursTo"
                type="time"
                defaultValue={value.quietHoursTo ?? "07:00"}
                className={inputClass}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-line pt-4">
        <label
          htmlFor="depositNote"
          className="block text-[14px] font-medium text-ink-700"
        >
          {t("Ghi chú đặt cọc hoặc thanh toán")}
        </label>
        <input
          id="depositNote"
          name="depositNote"
          maxLength={400}
          defaultValue={value.depositNote ?? ""}
          placeholder={t("Đặt cọc, tiền mặt, chuyển khoản hoặc hướng dẫn thanh toán")}
          className={inputClass}
        />
      </div>
    </section>
  );
}
