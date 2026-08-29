import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { canManageBookings, requireMember } from "@/lib/dal";
import { loadDashboard, longDate, weekdayShort } from "@/lib/dashboard";
import { formatVnd, todayIn } from "@/lib/dates";
import { getT, readLocale } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Bảng điều khiển") };
}

/** One glyph per tile. Inline for the same reason as the rail's — one weight. */
const TILE_ICONS = {
  arrive: "M19 5 5 19M5 19h9M5 19v-9",
  depart: "M5 19 19 5M19 5h-9M19 5v9",
  bed: "M3 18v-9M3 13h18v5M7.5 10.5h3.5a2 2 0 0 1 2 2v.5H7.5v-2.5ZM13 13h8a0 0 0 0 1 0 0v0a4 4 0 0 0-4-4h-4v4Z",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z",
  booked: "M8 2v3M16 2v3M3.5 9.5h17M4 5.5h16a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1ZM12 13v4M10 15h4",
  cancel: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.5l5 5M14.5 9.5l-5 5",
  over: "M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-1.5a4 4 0 0 0-3-3.87M16 3.63a4 4 0 0 1 0 7.75",
} as const;

function Tile({
  icon,
  value,
  label,
  alarm = false,
}: {
  icon: keyof typeof TILE_ICONS;
  value: number;
  label: string;
  alarm?: boolean;
}) {
  return (
    <div className="card flex flex-col gap-1 p-3">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={alarm ? "text-danger" : "text-brand"}
      >
        <path d={TILE_ICONS[icon]} />
      </svg>
      <p
        className={`text-[20px] font-bold leading-5 tnum ${
          alarm ? "text-danger" : "text-ink-900"
        }`}
      >
        {value}
      </p>
      <p className="text-[11px] font-medium text-ink-500">{label}</p>
    </div>
  );
}

/**
 * The occupancy ring.
 *
 * A stroked circle rather than a chart library: three numbers that always sum
 * to the room count do not need one, and the arithmetic is a circumference and
 * two offsets. `pathLength="100"` lets the dash values be read as percentages
 * directly, which is the only part of this that would otherwise need a comment.
 */
function Ring({
  booked,
  blocked,
  total,
  label,
}: {
  booked: number;
  blocked: number;
  total: number;
  label: string;
}) {
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const bookedPct = pct(booked);
  const blockedPct = pct(blocked);

  return (
    <div className="relative size-[140px] shrink-0">
      <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden="true">
        <circle
          cx="21"
          cy="21"
          r="15.9"
          fill="none"
          stroke="var(--color-sand-200)"
          strokeWidth="4"
          pathLength="100"
        />
        <circle
          cx="21"
          cy="21"
          r="15.9"
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="4"
          pathLength="100"
          strokeDasharray={`${bookedPct} ${100 - bookedPct}`}
        />
        <circle
          cx="21"
          cy="21"
          r="15.9"
          fill="none"
          stroke="var(--color-ink-300)"
          strokeWidth="4"
          pathLength="100"
          strokeDasharray={`${blockedPct} ${100 - blockedPct}`}
          strokeDashoffset={-bookedPct}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[22px] font-bold leading-none text-ink-900 tnum">
            {Math.round(bookedPct)}%
          </p>
          <p className="mt-1 text-[11px] text-ink-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage(props: PageProps<"/tong-quan">) {
  const t = await getT();
  const locale = await readLocale();
  const member = await requireMember();
  if (!canManageBookings(member)) redirect("/buong-phong");

  const params = await props.searchParams;
  const offset = params.ngay === "mai" ? 1 : 0;

  const today = todayIn(member.timezone);
  const d = await loadDashboard(member, today, offset);

  if (d.roomCount === 0) {
    return (
      <>
        <h1 className="text-[18px] font-semibold text-ink-900">
          {t("Bảng điều khiển")}
        </h1>
        <EmptyState
          title={t("Chưa có cơ sở nào")}
          description={t("Thêm chỗ nghỉ đầu tiên và các phòng của nó. Lịch, buồng phòng và trang đặt phòng đều dựng lên từ đó.")}
          actionLabel={t("Thêm chỗ nghỉ")}
          actionHref="/cho-nghi/moi"
        />
      </>
    );
  }

  const maxRevenue = Math.max(1, ...d.forecast.map((f) => f.revenue));

  return (
    <>
      <h1 className="text-[18px] font-semibold text-ink-900">
        {t("Bảng điều khiển")}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-[14px] font-medium text-ink-900">
          {longDate(d.date, locale)}
        </p>
        {/* Links, not buttons: which day you are looking at belongs in the URL,
            so it survives a refresh and can be sent to someone. */}
        <nav aria-label={t("Chọn ngày")} className="flex items-center gap-1">
          {[
            { key: "hom-nay", label: t("Hôm nay"), href: "/tong-quan", active: offset === 0 },
            { key: "mai", label: t("Ngày mai"), href: "/tong-quan?ngay=mai", active: offset === 1 },
          ].map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`flex h-8 items-center rounded-full px-3 text-[12px] font-semibold transition-colors ${
                tab.active
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-sand-200"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>

      {d.attention.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {d.attention.map((item) => (
            <li key={item.text}>
              <Link
                href={item.href}
                className="flex min-h-10 items-center justify-between gap-4 rounded-xl border border-warning/30 bg-warning-soft px-4 py-2.5 text-[13.5px] text-ink-800 hover:bg-warning-soft/70"
              >
                <span>{item.text}</span>
                <span aria-hidden="true" className="shrink-0 text-warning">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ---- the day ------------------------------------------------------ */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        <Tile icon="arrive" value={d.arrivals.length} label={t("Khách đến")} />
        <Tile icon="depart" value={d.departures.length} label={t("Khách đi")} />
        <Tile icon="bed" value={d.inHouse} label={t("Đang lưu trú")} />
        <Tile icon="moon" value={d.stayovers} label={t("Ở tiếp")} />
        <Tile icon="booked" value={d.bookedOn} label={t("Đơn đặt")} />
        <Tile icon="cancel" value={d.cancelledOn} label={t("Hủy")} />
        <Tile
          icon="over"
          value={d.overbooked}
          label={t("Vượt phòng")}
          alarm={d.overbooked > 0}
        />
      </div>

      {/* ---- occupancy, and who is moving today --------------------------- */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">{t("Lấp đầy")}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <Ring
              booked={d.booked}
              blocked={d.blocked}
              total={d.roomCount}
              label={t("Lấp đầy")}
            />
            <dl
              className="min-w-40 flex-1 text-[13.5px]"
              aria-label={fill(
                t("{daDat} phòng đã đặt, {daChan} phòng đã chặn, {conTrong} phòng còn trống trên tổng {tong}"),
                {
                  daDat: d.booked,
                  daChan: d.blocked,
                  conTrong: d.free,
                  tong: d.roomCount,
                },
              )}
            >
              {[
                { key: "booked", swatch: "bg-brand", label: t("Đã đặt"), value: d.booked },
                { key: "free", swatch: "bg-sand-200", label: t("Còn trống"), value: d.free },
                { key: "blocked", swatch: "bg-ink-300", label: t("Đã chặn"), value: d.blocked },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0"
                >
                  <dt className="flex items-center gap-2 text-ink-700">
                    <span className={`size-2.5 rounded-[3px] ${row.swatch}`} />
                    {row.label}
                  </dt>
                  <dd className="font-semibold text-ink-900 tnum">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-[15px] font-semibold text-ink-900">
            {t("Hoạt động đặt phòng")}
          </h2>

          {/* inHouse counts too. Without it the panel said "no arrivals and
              nobody staying" on a day with a guest in a room — the tile two
              inches above it read 1. */}
          {d.arrivals.length === 0 &&
          d.departures.length === 0 &&
          d.inHouse === 0 ? (
            <p className="mt-3 text-[14px] leading-relaxed text-ink-500">
              {t("Không có khách đến hay khách lưu trú trong ngày này.")}
            </p>
          ) : (
            <div className="mt-3 grid gap-5 sm:grid-cols-2">
              {[
                { title: t("Khách đến"), list: d.arrivals, empty: t("Không có ai nhận phòng.") },
                { title: t("Khách đi"), list: d.departures, empty: t("Không có ai trả phòng.") },
              ].map((col) => (
                <div key={col.title}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500">
                    {col.title}
                  </h3>
                  {col.list.length === 0 ? (
                    <p className="mt-2 text-[13.5px] text-ink-500">{col.empty}</p>
                  ) : (
                    <ul className="mt-1 divide-y divide-line">
                      {col.list.map((m) => (
                        <li key={`${m.roomName}-${m.guestName}`} className="py-2">
                          <p className="text-[14px] font-medium text-ink-900">
                            {m.guestName}
                          </p>
                          <p className="text-[12.5px] text-ink-500">
                            {m.roomName} · <span className="tnum">{m.guests}</span>{" "}
                            {t("khách")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {d.roomsNeedingClean > 0 ? (
            <Link
              href="/buong-phong"
              className="mt-4 inline-flex min-h-10 items-center text-[13.5px] font-semibold text-brand hover:underline"
            >
              {fill(t("{n} phòng cần dọn →"), { n: d.roomsNeedingClean })}
            </Link>
          ) : null}
        </section>
      </div>

      {/* ---- forecast ------------------------------------------------------ */}
      <section className="mt-3 card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink-900">
            {t("Dự báo 14 ngày")}
          </h2>
          <p className="text-[12.5px] text-ink-500">
            {t("Trung bình")}{" "}
            <span className="font-semibold text-ink-900 tnum">
              {d.forecastAverage}%
            </span>{" "}
            ·{" "}
            <span className="tnum">
              {formatVnd(
                d.forecast.reduce((sum, f) => sum + f.revenue, 0),
                locale,
              )}
            </span>
          </p>
        </div>

        <ul className="mt-4 flex items-end gap-1.5 overflow-x-auto pb-1">
          {d.forecast.map((f) => (
            <li key={f.date.toISOString()} className="min-w-11 flex-1 text-center">
              {/* Bar height tracks revenue, the label tracks occupancy: the two
                  come apart when a cheap room fills and an expensive one does
                  not, which is exactly the week worth noticing. */}
              <div className="flex h-20 items-end justify-center">
                <span
                  className={`w-full rounded ${
                    f.occupancy > 0 ? "bg-brand" : "bg-clay-100"
                  }`}
                  style={{
                    height: `${Math.max(6, (f.revenue / maxRevenue) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] font-medium text-ink-700 tnum">
                {f.occupancy}%
              </p>
              <p className="text-[10.5px] text-ink-400">
                {weekdayShort(f.date, locale)} {f.date.getUTCDate()}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-500">
          {t("Cột cao theo doanh thu, con số theo tỷ lệ lấp đầy. Hai thứ này tách nhau khi phòng rẻ kín mà phòng đắt trống — đó chính là tuần đáng để ý. Lượt đặt chưa nhập giá tính theo giá niêm yết của phòng; phòng chưa có giá không đóng góp gì.")}
        </p>
      </section>
    </>
  );
}
