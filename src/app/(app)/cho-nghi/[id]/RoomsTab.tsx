"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { AmenityPicker } from "@/components/AmenityPicker";
import { useT } from "@/components/I18nProvider";
import { fill } from "@/lib/i18n";

import type { RoomState } from "./actions";

/**
 * Tab Phòng: hai thẻ số, danh sách phòng, và một form mở ra khi cần.
 *
 * Bản thiết kế được đưa gọi thẻ thứ nhất là "Loại phòng". Ứng dụng này không
 * có loại phòng — một Room chính là thứ đặt được, và ghi chú trong
 * cho-nghi/actions.ts giải thích vì sao đó là điều giữ cho ràng buộc chống
 * trùng lịch chỉ có một hình dạng. Nên hai thẻ ở đây đếm thứ có thật: bao
 * nhiêu phòng, và chứa được bao nhiêu khách.
 *
 * Form sửa mở ngay trong thẻ phòng chứ không phải hộp thoại. Một hộp thoại
 * che mất những phòng khác, mà "phòng này giá bao nhiêu so với phòng kia" là
 * câu người ta hỏi trong lúc sửa.
 */

export type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  maxAdults: number;
  maxChildren: number;
  capacity: number;
  basePrice: number | null;
  minNights: number;
  maxNights: number | null;
  amenities: string[];
};

const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[15px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? busy : label}
    </button>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-line bg-surface px-5 py-4">
      <p className="text-[22px] font-semibold text-ink-900 tnum">{value}</p>
      <p className="mt-0.5 text-[13px] text-ink-500">{label}</p>
    </div>
  );
}

function Notices({ state }: { state: RoomState }) {
  return (
    <>
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
    </>
  );
}

/** Những ô chung giữa form thêm và form sửa. */
function RoomFields({
  room,
  locale,
  amenities,
  onAmenities,
  currency,
}: {
  room?: RoomRow;
  locale: "vi" | "en";
  amenities: string[];
  onAmenities: (ids: string[]) => void;
  currency: string;
}) {
  const t = useT();
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-[14px] font-medium text-ink-700">
          {t("Tên phòng")}
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={room?.name ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-[14px] font-medium text-ink-700"
        >
          {t("Mô tả")}
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={room?.description ?? ""}
          className={`${inputClass} py-2.5`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="maxAdults"
            className="block text-[14px] font-medium text-ink-700"
          >
            {t("Người lớn tối đa")}
          </label>
          <input
            id="maxAdults"
            name="maxAdults"
            type="number"
            min={1}
            max={30}
            required
            defaultValue={room?.maxAdults ?? 2}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="maxChildren"
            className="block text-[14px] font-medium text-ink-700"
          >
            {t("Trẻ em tối đa")}
          </label>
          <input
            id="maxChildren"
            name="maxChildren"
            type="number"
            min={0}
            max={30}
            required
            defaultValue={room?.maxChildren ?? 0}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="basePrice"
          className="block text-[14px] font-medium text-ink-700"
        >
          {fill(t("Giá mỗi đêm ({tien})"), { tien: currency })}
        </label>
        <input
          id="basePrice"
          name="basePrice"
          inputMode="numeric"
          defaultValue={room?.basePrice ?? ""}
          className={inputClass}
        />
        <p className="mt-1.5 text-[13px] text-ink-500">
          {t("Để trống nếu chưa đặt giá. Phòng vẫn nhận đặt, khách chỉ không thấy con số nào.")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="minNights"
            className="block text-[14px] font-medium text-ink-700"
          >
            {t("Số đêm ít nhất")}
          </label>
          <input
            id="minNights"
            name="minNights"
            type="number"
            min={1}
            max={365}
            required
            defaultValue={room?.minNights ?? 1}
            className={inputClass}
          />
        </div>
        <div>
          <label
            htmlFor="maxNights"
            className="block text-[14px] font-medium text-ink-700"
          >
            {t("Số đêm nhiều nhất")}
          </label>
          <input
            id="maxNights"
            name="maxNights"
            type="number"
            min={1}
            max={365}
            defaultValue={room?.maxNights ?? ""}
            className={inputClass}
          />
          <p className="mt-1.5 text-[13px] text-ink-500">
            {t("Để trống nghĩa là không giới hạn.")}
          </p>
        </div>
      </div>

      <AmenityPicker
        label={t("Tiện nghi trong phòng")}
        scope="room"
        lang={locale}
        selected={amenities}
        onChange={onAmenities}
      />
      <input type="hidden" name="roomAmenities" value={JSON.stringify(amenities)} />
    </div>
  );
}

function AddRoom({
  action,
  propertyId,
  locale,
  currency,
  onDone,
}: {
  action: (prev: RoomState, formData: FormData) => Promise<RoomState>;
  propertyId: string;
  locale: "vi" | "en";
  currency: string;
  onDone: () => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState<RoomState, FormData>(action, {
    error: null,
  });
  const [amenities, setAmenities] = useState<string[]>([]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-line bg-surface p-5"
    >
      <input type="hidden" name="propertyId" value={propertyId} />
      <Notices state={state} />

      <div>
        <label htmlFor="count" className="block text-[14px] font-medium text-ink-700">
          {t("Số phòng cùng loại")}
        </label>
        <input
          id="count"
          name="count"
          type="number"
          min={1}
          max={50}
          defaultValue={1}
          className={inputClass}
        />
        <p className="mt-1.5 text-[13px] text-ink-500">
          {t("Nhiều hơn một thì tên phòng được đánh số: Standard 1, Standard 2…")}
        </p>
      </div>

      <RoomFields
        locale={locale}
        amenities={amenities}
        onAmenities={setAmenities}
        currency={currency}
      />

      <div className="flex gap-3">
        <Submit label={t("Thêm phòng")} busy={t("Đang thêm…")} />
        <button
          type="button"
          onClick={onDone}
          className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-ink-700 hover:border-ink-900"
        >
          {t("Hủy")}
        </button>
      </div>
    </form>
  );
}

function EditRoom({
  action,
  deleteAction,
  room,
  locale,
  currency,
  onDone,
}: {
  action: (prev: RoomState, formData: FormData) => Promise<RoomState>;
  deleteAction: (prev: RoomState, formData: FormData) => Promise<RoomState>;
  room: RoomRow;
  locale: "vi" | "en";
  currency: string;
  onDone: () => void;
}) {
  const t = useT();
  const [state, formAction] = useActionState<RoomState, FormData>(action, {
    error: null,
  });
  const [delState, delAction] = useActionState<RoomState, FormData>(deleteAction, {
    error: null,
  });
  const [amenities, setAmenities] = useState<string[]>(room.amenities);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="roomId" value={room.id} />
        <Notices state={state} />
        <RoomFields
          room={room}
          locale={locale}
          amenities={amenities}
          onAmenities={setAmenities}
          currency={currency}
        />
        <div className="flex gap-3">
          <Submit label={t("Lưu thay đổi")} busy={t("Đang lưu…")} />
          <button
            type="button"
            onClick={onDone}
            className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-ink-700 hover:border-ink-900"
          >
            {t("Xong")}
          </button>
        </div>
      </form>

      {/* Xoá tách khỏi form sửa. Nếu chung một form, cái nút nguy hiểm nhất
          trong sản phẩm sẽ nằm ngay cạnh cái nút người ta bấm mỗi ngày. */}
      <div className="rounded-xl border border-danger/25 bg-danger-soft/40 p-4">
        <Notices state={delState} />
        {confirming ? (
          <form action={delAction} className="space-y-3">
            <input type="hidden" name="roomId" value={room.id} />
            <p className="text-[13.5px] leading-relaxed text-ink-700">
              {t("Xóa phòng này sẽ xóa luôn mọi lượt đặt của nó, kể cả những lượt đã ở xong. Gõ đúng tên phòng để xác nhận.")}
            </p>
            <input
              name="confirmName"
              placeholder={room.name}
              aria-label={t("Tên phòng")}
              className={inputClass}
            />
            <div className="flex gap-3">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-full bg-danger px-5 text-[14px] font-semibold text-white hover:opacity-90"
              >
                {t("Xóa phòng")}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-ink-700 hover:border-ink-900"
              >
                {t("Hủy")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-[13.5px] font-semibold text-danger underline underline-offset-4"
          >
            {t("Xóa phòng")}
          </button>
        )}
      </div>
    </div>
  );
}

export function RoomsTab({
  rooms,
  propertyId,
  locale,
  currency,
  createAction,
  updateAction,
  deleteAction,
}: {
  rooms: RoomRow[];
  propertyId: string;
  locale: "vi" | "en";
  currency: string;
  createAction: (prev: RoomState, formData: FormData) => Promise<RoomState>;
  updateAction: (prev: RoomState, formData: FormData) => Promise<RoomState>;
  deleteAction: (prev: RoomState, formData: FormData) => Promise<RoomState>;
}) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const guests = rooms.reduce((sum, r) => sum + r.capacity, 0);
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN");

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-stretch gap-3">
        <Stat value={String(rooms.length)} label={t("Phòng")} />
        <Stat value={String(guests)} label={t("Sức chứa tổng")} />
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 self-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 transition-colors hover:bg-ink-800"
          >
            <span aria-hidden="true">+</span>
            {t("Thêm phòng")}
          </button>
        ) : null}
      </div>

      {adding ? (
        <AddRoom
          action={createAction}
          propertyId={propertyId}
          locale={locale}
          currency={currency}
          onDone={() => setAdding(false)}
        />
      ) : null}

      {rooms.length === 0 && !adding ? (
        <p className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-[14px] text-ink-500">
          {t("Cơ sở này chưa có phòng nào.")}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rooms.map((room) => (
          <li key={room.id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-ink-900">{room.name}</p>
                {room.description ? (
                  <p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-600">
                    {room.description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => setEditing(editing === room.id ? null : room.id)}
                aria-expanded={editing === room.id}
                className="shrink-0 rounded-full border border-line-strong px-4 py-2 text-[13px] font-semibold text-ink-700 hover:border-ink-900"
              >
                {editing === room.id ? t("Đóng") : t("Sửa")}
              </button>
            </div>

            {/* Một dòng dữ kiện, cùng thứ tự với bản thiết kế: sức chứa, giá,
                số đêm. Giá chưa đặt hiện thành gạch ngang chứ không phải số 0
                — số 0 là một mức giá, còn đây là chưa có giá. */}
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-600">
              <span className="tnum">
                {fill(t("{a} người lớn · {b} trẻ em"), {
                  a: room.maxAdults,
                  b: room.maxChildren,
                })}
              </span>
              <span className="tnum">
                {room.basePrice === null
                  ? t("Chưa đặt giá")
                  : `${money.format(room.basePrice)} ${currency} / ${t("đêm")}`}
              </span>
              <span className="tnum">
                {room.maxNights === null
                  ? fill(t("từ {n} đêm"), { n: room.minNights })
                  : fill(t("{a}–{b} đêm"), { a: room.minNights, b: room.maxNights })}
              </span>
            </p>

            {editing === room.id ? (
              <div className="mt-5 border-t border-line pt-5">
                <EditRoom
                  action={updateAction}
                  deleteAction={deleteAction}
                  room={room}
                  locale={locale}
                  currency={currency}
                  onDone={() => setEditing(null)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
