"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { AmenityPicker } from "@/components/AmenityPicker";
import { useT } from "@/components/I18nProvider";
import { fill, type Locale } from "@/lib/i18n";

type State = { error: string | null; notice?: string };

/**
 * Thêm phòng bằng một ngăn kéo trượt từ phải, mở ngay trên bảng lịch.
 *
 * Ngăn kéo chứ không phải một trang riêng: chủ nhà bấm "Thêm phòng" khi đang
 * nhìn lịch và nhận ra thiếu một phòng. Đưa họ sang trang khác rồi bắt bấm
 * quay lại là làm mất chỗ họ đang xem, và mất luôn lý do họ mở nó ra.
 *
 * Ảnh phòng có một chỗ trống nói thẳng "lưu phòng này trước" — giống bản
 * thiết kế được đưa, và cũng là sự thật ở đây: chưa có nơi lưu ảnh nào được
 * chọn. Một ô kéo-thả không làm gì thì tệ hơn một câu nói rõ.
 */
export function AddRoomPanel({
  propertyId,
  propertyName,
  action,
  locale,
  currency,
  label,
}: {
  propertyId: string;
  propertyName: string;
  action: (prev: State, formData: FormData) => Promise<State>;
  locale: Locale;
  currency: string;
  /** Nhãn nút, dịch sẵn phía máy chủ. */
  label: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Hai ô này được điều khiển để dải tóm tắt ở cuối luôn nói đúng thứ đang gõ.
  // Những ô còn lại vẫn để trình duyệt giữ: không có gì đọc chúng theo thời
  // gian thực, nên biến chúng thành controlled chỉ thêm việc cho React.
  const [count, setCount] = useState("1");
  const [price, setPrice] = useState("");

  /**
   * Gọi thẳng action trong một hàm async thay vì qua useActionState.
   *
   * useActionState trả kết quả về dưới dạng state, nên "lưu xong thì đóng"
   * phải suy ra từ sự thay đổi của state đó — bằng một effect, hoặc bằng một
   * phép so danh tính trong lúc render. Cách thứ nhất bị luật
   * react-hooks/set-state-in-effect chặn; cách thứ hai đã thử và ngăn kéo
   * không đóng, vì phần tử này đổi chỗ giữa các anh em khi số phòng tăng.
   *
   * Ở đây thì không phải suy ra gì: đợi action trả về, rồi tự quyết định.
   * React chấp nhận một hàm async làm `action` của form, và form vẫn hoạt
   * động khi JavaScript chưa kịp tải — chỉ khác là lúc đó nó tải lại trang.
   */
  async function submit(formData: FormData) {
    // Đóng NGAY, trước khi chờ. Đóng sau khi await xong thì không ăn thua: khi
    // action trả về, revalidatePath đã vẽ lại cả cây từ máy chủ, và lệnh đóng
    // rơi vào một bản dựng khác của component — đã thử, ngăn kéo vẫn nằm đó.
    //
    // Đổi lại phải mở lại khi hỏng. Thêm phòng gần như luôn thành công, nên
    // đây là đánh đổi đúng chiều: trường hợp thường thì mượt, trường hợp hiếm
    // thì ngăn kéo quay lại kèm câu báo lỗi và mọi thứ vừa gõ.
    setOpen(false);
    setBusy(true);
    const result = await action({ error: null }, formData);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      setOpen(true);
      return;
    }
    setError(null);
    setAmenities([]);
    setCount("1");
    setPrice("");
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const input =
    "mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-white px-3.5 text-[15px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15";
  const heading =
    "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
      >
        <span aria-hidden="true" className="text-[15px] leading-none">
          +
        </span>
        {label}
      </button>

      {/* Ngăn kéo đi qua portal lên thẳng <body>.
          ----------------------------------------------------------------
          Nút mở nó nằm trong một ô của bảng lịch, mà ô đó là
          `position: sticky; z-index: 2` — tức là một stacking context riêng.
          Mọi thứ vẽ bên trong ô ấy chỉ xếp lớp được với nhau; z-50 của lớp
          phủ không bao giờ vượt lên trên những ô sticky đứng SAU nó trong
          DOM. Kết quả: ngăn kéo mở ra mà vài ô ở góc dưới bên trái vẫn sáng
          nguyên, nằm đè lên lớp phủ.
          Đo được bằng document.elementFromPoint trên đúng những ô đó: nó trả
          về chính cái link, không phải lớp phủ.
          Portal đưa ngăn kéo ra khỏi ô, thành con của <body>, nơi z-50 có
          nghĩa so với cả trang. */}
      {open
        ? createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Nền mờ là một nút thật, không phải một thẻ div bắt sự kiện: bấm
              ra ngoài để đóng phải dùng được cả bằng bàn phím. */}
          <button
            type="button"
            aria-label={t("Đóng")}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink-950/30"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="relative flex h-full w-full max-w-md flex-col bg-surface shadow-xl"
          >
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              {/* Ô biểu tượng đầu tiêu đề, giống bản thiết kế. Chỉ trang trí,
                  nên aria-hidden — cái tên ngay bên cạnh đã nói nó là gì. */}
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-clay-50 text-brand"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 18v-9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9" />
                  <path d="M3 14h18" />
                  <path d="M7 11h4" />
                  <path d="M3 18v2M21 18v2" />
                </svg>
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                  {propertyName}
                </p>
                <h2 className="mt-0.5 text-[1.125rem] font-semibold text-ink-900">
                  {label}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("Đóng")}
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-sand-100 hover:text-ink-900"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <form
              action={submit}
              className="flex min-h-0 flex-1 flex-col"
              id="add-room"
            >
              <input type="hidden" name="propertyId" value={propertyId} />
              <input
                type="hidden"
                name="roomAmenities"
                value={JSON.stringify(amenities)}
              />

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
                {error ? (
                  <p
                    role="alert"
                    tabIndex={-1}
                    className="rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-[14px] text-danger"
                  >
                    {error}
                  </p>
                ) : null}

                <section>
                  <h3 className={heading}>{t("Thông tin cơ bản")}</h3>
                  <div className="mt-3 space-y-4">
                    <div>
                      <label
                        htmlFor="ar-name"
                        className="block text-[14px] font-medium text-ink-700"
                      >
                        {t("Tên phòng")}
                      </label>
                      <input id="ar-name" name="name" required className={input} />
                    </div>
                    <div>
                      <label
                        htmlFor="ar-desc"
                        className="block text-[14px] font-medium text-ink-700"
                      >
                        {t("Mô tả")}
                      </label>
                      <textarea
                        id="ar-desc"
                        name="description"
                        rows={3}
                        placeholder={t("Giường, phòng tắm, tầm nhìn, ban công — điều khách nên biết.")}
                        className={`${input} py-2.5`}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className={heading}>{t("Ảnh phòng")}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
                    {t("Hiển thị cho khách trên trang đặt phòng. Ảnh đầu tiên là ảnh bìa.")}
                  </p>
                  <p className="mt-3 rounded-xl border border-dashed border-line-strong px-4 py-3 text-[13px] text-ink-500">
                    {t("Phần ảnh chưa làm — nó cần một nơi lưu trữ được chọn trước.")}
                  </p>
                </section>

                <section>
                  <AmenityPicker
                    label={t("Tiện nghi trong phòng")}
                    scope="room"
                    lang={locale}
                    selected={amenities}
                    onChange={setAmenities}
                  />
                </section>

                <section>
                  <h3 className={heading}>{t("Giá & sức chứa")}</h3>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="ar-count"
                        className="block text-[14px] font-medium text-ink-700"
                      >
                        {t("Số lượng phòng")}
                      </label>
                      <input
                        id="ar-count"
                        name="count"
                        type="number"
                        min={1}
                        max={50}
                        value={count}
                        onChange={(e) => setCount(e.target.value)}
                        className={input}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ar-price"
                        className="block text-[14px] font-medium text-ink-700"
                      >
                        {t("Giá mỗi đêm")}
                      </label>
                      {/* Đơn vị tiền nằm trong ô, canh phải — như bản thiết
                          kế. Nó là một nhãn chứ không phải một ô nhập: tiền
                          tệ do tổ chức đặt, không đổi được ở đây. */}
                      <div className="relative">
                        <input
                          id="ar-price"
                          name="basePrice"
                          inputMode="numeric"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className={`${input} pr-14`}
                        />
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[13px] font-medium text-ink-400"
                        >
                          {currency}
                        </span>
                      </div>
                    </div>
                    <div>
                      <label
                        htmlFor="ar-adults"
                        className="block text-[14px] font-medium text-ink-700"
                      >
                        {t("Tối đa người lớn")}
                      </label>
                      <input
                        id="ar-adults"
                        name="maxAdults"
                        type="number"
                        min={1}
                        max={30}
                        defaultValue={2}
                        className={input}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ar-children"
                        className="block text-[14px] font-medium text-ink-700"
                      >
                        {t("Tối đa trẻ em")}
                      </label>
                      <input
                        id="ar-children"
                        name="maxChildren"
                        type="number"
                        min={0}
                        max={30}
                        defaultValue={0}
                        className={input}
                      />
                    </div>
                  </div>
                </section>

                {/* Số đêm tối thiểu/tối đa gập lại: phần lớn phòng không đặt
                    giới hạn nào, và hai ô luôn mở làm form dài ra vì một câu
                    hỏi hiếm khi được trả lời. <details> chứ không phải state
                    riêng — trình duyệt đã biết gập mở, kể cả khi chưa có
                    JavaScript. */}
                <details className="group rounded-xl border border-line">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    {t("Quy tắc lưu trú nâng cao")}
                    <svg
                      viewBox="0 0 16 16"
                      className="size-4 transition-transform group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </summary>

                  <div className="grid gap-4 border-t border-line px-4 py-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="ar-min"
                        className="block text-[14px] font-medium text-ink-700"
                      >
                        {t("Số đêm ít nhất")}
                      </label>
                      <input
                        id="ar-min"
                        name="minNights"
                        type="number"
                        min={1}
                        max={365}
                        defaultValue={1}
                        className={input}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ar-max"
                        className="block text-[14px] font-medium text-ink-700"
                      >
                        {t("Số đêm nhiều nhất")}
                      </label>
                      <input
                        id="ar-max"
                        name="maxNights"
                        type="number"
                        min={1}
                        max={365}
                        className={input}
                      />
                      <p className="mt-1.5 text-[13px] text-ink-500">
                        {t("Để trống nghĩa là không giới hạn.")}
                      </p>
                    </div>
                  </div>
                </details>

                {/* Dải tóm tắt: đọc lại thành câu những gì vừa gõ. Nó bắt
                    được cái lỗi mà không ô nào bắt được — gõ nhầm một số 0 vào
                    giá thì con số ở đây đọc lên nghe sai ngay. */}
                <p className="rounded-xl bg-clay-50 px-4 py-3 text-[14px] text-ink-800">
                  <span className="tnum font-medium">
                    {fill(t("{n} phòng"), { n: Number(count) || 0 })}
                  </span>
                  {price.trim() !== "" && Number(price) > 0 ? (
                    <span className="tnum float-right font-semibold">
                      {new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN").format(
                        Number(price),
                      )}{" "}
                      {currency} / {t("đêm")}
                    </span>
                  ) : (
                    <span className="float-right text-ink-500">{t("Chưa đặt giá")}</span>
                  )}
                </p>
              </div>

              <Footer onClose={() => setOpen(false)} label={label} busy={busy} />
            </form>
          </div>
        </div>,
            document.body,
          )
        : null}
    </>
  );
}

/** Chân ngăn kéo: đóng, và gửi. */
function Footer({
  onClose,
  label,
  busy,
}: {
  onClose: () => void;
  label: string;
  busy: boolean;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-4">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-ink-700 hover:border-ink-900"
      >
        {t("Đóng")}
      </button>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? t("Đang thêm…") : label}
      </button>
    </div>
  );
}
