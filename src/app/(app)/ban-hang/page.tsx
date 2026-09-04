import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { canManageBookings, orgCurrency, requireMember } from "@/lib/dal";
import {
  addDays,
  daysBetween,
  formatMoney,
  parseIsoDate,
  shortVi,
  todayIn,
  toIsoDate,
} from "@/lib/dates";
import { fill } from "@/lib/i18n";
import { getT, readLocale } from "@/lib/locale";
import { findVacancies } from "@/lib/sales";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Nhận đặt phòng") };
}

const MAX_NIGHTS = 90;

export default async function SalesPage(props: PageProps<"/ban-hang">) {
  const t = await getT();
  const locale = await readLocale();
  const member = await requireMember();
  const currency = await orgCurrency();

  // A housekeeper must not reach this: it prices rooms and names the guests
  // who hold them. The nav does not offer it either, but the nav is not a
  // boundary — a typed URL has to be turned away here.
  if (!canManageBookings(member)) redirect("/buong-phong");

  const params = await props.searchParams;
  const today = todayIn(member.timezone);

  const asked = {
    from: typeof params.tu === "string" ? parseIsoDate(params.tu) : null,
    to: typeof params.den === "string" ? parseIsoDate(params.den) : null,
    guests: Number(typeof params.khach === "string" ? params.khach : 2),
  };

  const from = asked.from ?? today;
  const to = asked.to ?? addDays(from, 1);
  const guests = Number.isFinite(asked.guests) && asked.guests > 0 ? asked.guests : 2;

  // The range decides whether there is anything to look up at all. An end date
  // on or before the start is not an error to shout about — nobody typed it on
  // purpose — so the form comes back with a note and no results.
  const valid = daysBetween(from, to) >= 1 && daysBetween(from, to) <= MAX_NIGHTS;

  const result = valid
    ? await findVacancies(member, { from, to, guests })
    : null;

  const byProperty = new Map<string, NonNullable<typeof result>["vacancies"]>();
  for (const vacancy of result?.vacancies ?? []) {
    const list = byProperty.get(vacancy.propertyName) ?? [];
    list.push(vacancy);
    byProperty.set(vacancy.propertyName, list);
  }

  return (
    <>
      <h1 className="text-[18px] font-semibold text-ink-900">
        {t("Nhận đặt phòng")}
      </h1>
      <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
        {t("Khách hỏi ngày nào, gõ ngày đó. Màn hình này trả lời còn phòng nào và bao nhiêu tiền cho cả kỳ — không phải dò trên lịch trong lúc khách đang chờ máy.")}
      </p>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-5"
      >
        <label className="text-[13px] font-medium text-ink-700">
          {t("Nhận phòng")}
          <input
            type="date"
            name="tu"
            defaultValue={toIsoDate(from)}
            className="mt-1.5 block min-h-11 rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
          />
        </label>
        <label className="text-[13px] font-medium text-ink-700">
          {t("Trả phòng")}
          <input
            type="date"
            name="den"
            defaultValue={toIsoDate(to)}
            className="mt-1.5 block min-h-11 rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
          />
        </label>
        <label className="text-[13px] font-medium text-ink-700">
          {t("Số khách")}
          <input
            type="number"
            name="khach"
            min={1}
            max={30}
            defaultValue={guests}
            className="mt-1.5 block min-h-11 w-24 rounded-xl border border-line-strong bg-white px-3.5 text-[16px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800"
        >
          {t("Tìm phòng trống")}
        </button>
      </form>

      {!valid ? (
        <p
          role="alert"
          className="mt-5 max-w-2xl rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-[14px] leading-relaxed text-warning"
        >
          {fill(t("Ngày trả phòng phải sau ngày nhận phòng, và tối đa {n} đêm một lần."), { n: MAX_NIGHTS })}
        </p>
      ) : result === null ? null : (
        <>
          <p className="mt-6 text-[14px] text-ink-600">
            <span className="font-medium text-ink-900">
              {fill(t("{trong} / {tong} phòng còn trống"), {
                trong: result.vacancies.length,
                tong: result.considered,
              })}
            </span>{" "}
            ·{" "}
            {fill(t("{tu} – {den}, {dem} đêm, {khach} khách"), {
              tu: shortVi(from),
              den: shortVi(to),
              dem: result.nights,
              khach: guests,
            })}
          </p>

          {result.considered === 0 ? (
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-600">
              {fill(t("Không có phòng nào nhận được {n} khách. Sức chứa đặt ở trang chỗ nghỉ."), { n: guests })}
            </p>
          ) : result.vacancies.length === 0 ? (
            <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-ink-600">
              {t("Kín hết những đêm này. Thử lệch một đêm, hoặc mở lịch xem ai đang giữ.")}{" "}
              <Link
                href={`/lich?from=${toIsoDate(addDays(from, -2))}`}
                className="font-medium text-ink-900 underline underline-offset-2"
              >
                {t("Mở lịch")}
              </Link>
            </p>
          ) : (
            <div className="mt-5 space-y-6">
              {[...byProperty].map(([propertyName, list]) => (
                <section key={propertyName}>
                  <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    {propertyName}
                  </h2>
                  <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
                    {list.map((v) => (
                      <li
                        key={v.roomId}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
                      >
                        <div className="min-w-40 flex-1">
                          <p className="text-[15px] font-medium text-ink-900">
                            {v.roomName}
                          </p>
                          <p className="mt-0.5 text-[12.5px] text-ink-500">
                            {fill(t("tối đa {n} khách"), { n: v.capacity })}
                          </p>
                        </div>

                        <div className="text-right">
                          {v.total === null ? (
                            <p className="text-[13px] text-ink-500">
                              {t("chưa đặt giá")}
                            </p>
                          ) : (
                            <>
                              <p className="text-[15px] font-semibold text-ink-900 tnum">
                                {formatMoney(v.total, currency, locale)}
                              </p>
                              <p className="text-[12.5px] text-ink-500 tnum">
                                {fill(t("{gia} × {dem} đêm"), {
                                  gia: formatMoney(v.basePrice ?? 0, currency, locale),
                                  dem: result.nights,
                                })}
                              </p>
                            </>
                          )}
                        </div>

                        {/* Straight into the booking form with the dates and
                            the room already filled in. Retyping what was just
                            typed is how a date ends up a day out. */}
                        <Link
                          href={`/lich/moi?room=${v.roomId}&from=${toIsoDate(from)}&to=${toIsoDate(to)}&guests=${guests}`}
                          className="inline-flex min-h-11 items-center rounded-full border border-line px-5 text-[14px] font-medium text-ink-700 hover:bg-sand-50"
                        >
                          {t("Đặt phòng này")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {result.taken > 0 && result.vacancies.length > 0 ? (
            <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-ink-500">
              {t("Còn trống ở đây nghĩa là còn trống lúc bạn mở trang. Hai người cùng nhận một phòng thì người lưu sau bị từ chối, và được nói rõ ai đang giữ — chỗ đó do cơ sở dữ liệu quyết, không phải màn hình này.")}
            </p>
          ) : null}
        </>
      )}
    </>
  );
}
