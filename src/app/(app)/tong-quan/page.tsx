import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { canManageBookings, requireMember } from "@/lib/dal";
import { loadDashboard, longVi, weekdayShortVi } from "@/lib/dashboard";
import { formatVnd, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Bảng điều khiển" };

function Stat({
  value,
  label,
  tone = "default",
}: {
  value: number | string;
  label: string;
  tone?: "default" | "accent" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3.5">
      <p
        className={`text-[1.625rem] font-semibold leading-none tnum ${
          tone === "danger"
            ? "text-danger"
            : tone === "accent"
              ? "text-clay-600"
              : "text-ink-900"
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[12.5px] font-medium leading-snug text-ink-600">
        {label}
      </p>
    </div>
  );
}

export default async function DashboardPage(props: PageProps<"/tong-quan">) {
  const member = await requireMember();
  if (!canManageBookings(member)) redirect("/buong-phong");

  const params = await props.searchParams;
  const offset = params.ngay === "mai" ? 1 : 0;

  const today = todayIn(member.timezone);
  const d = await loadDashboard(member, today, offset);

  if (d.roomCount === 0) {
    return (
      <>
        <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
          Bảng điều khiển
        </h1>
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="text-[15px] font-semibold text-ink-900">
            Chưa có cơ sở nào
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-600">
            Thêm chỗ nghỉ đầu tiên và các phòng của nó. Lịch, buồng phòng và
            trang đặt phòng đều dựng lên từ đó.
          </p>
          <Link
            href="/cho-nghi/moi"
            className="mt-5 inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100"
          >
            Thêm chỗ nghỉ
          </Link>
        </div>
      </>
    );
  }

  const maxRevenue = Math.max(1, ...d.forecast.map((f) => f.revenue));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
            Bảng điều khiển
          </h1>
          <p className="mt-1 text-[14px] text-ink-600">{longVi(d.date)}</p>
        </div>

        {/* Links, not buttons: which day you are looking at belongs in the URL,
            so it survives a refresh and can be sent to someone. */}
        <nav aria-label="Chọn ngày" className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
          {[
            { key: "hom-nay", label: "Hôm nay", href: "/tong-quan", active: offset === 0 },
            { key: "mai", label: "Ngày mai", href: "/tong-quan?ngay=mai", active: offset === 1 },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`flex min-h-9 items-center rounded-full px-4 text-[14px] font-medium transition-colors ${
                t.active
                  ? "bg-ink-900 text-sand-100"
                  : "text-ink-600 hover:bg-ink-100"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {d.attention.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {d.attention.map((item) => (
            <li key={item.text}>
              <Link
                href={item.href}
                className="flex min-h-11 items-center justify-between gap-4 rounded-2xl border border-warning/30 bg-warning-soft px-5 py-3 text-[14px] text-ink-800 hover:bg-warning-soft/70"
              >
                <span>{item.text}</span>
                <span aria-hidden="true" className="shrink-0 text-warning">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {/* ---- the day ------------------------------------------------------ */}
      <div className="mt-6 grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat value={d.arrivals.length} label="Khách đến" />
        <Stat value={d.departures.length} label="Khách đi" />
        <Stat value={d.inHouse} label="Đang lưu trú" />
        <Stat value={d.stayovers} label="Ở tiếp" />
        <Stat value={d.bookedOn} label="Đơn đặt" />
        <Stat value={d.cancelledOn} label="Hủy" />
        <Stat
          value={d.overbooked}
          label="Vượt phòng"
          tone={d.overbooked > 0 ? "danger" : "default"}
        />
      </div>

      {/* ---- occupancy ---------------------------------------------------- */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-medium text-ink-600">Lấp đầy</p>
            <p className="mt-1 text-[2rem] font-semibold leading-none text-ink-900 tnum">
              {Math.round((d.booked / d.roomCount) * 100)}%
            </p>
          </div>
          <dl className="flex gap-6 text-[13px]">
            <div>
              <dt className="text-ink-500">Đã đặt</dt>
              <dd className="mt-0.5 text-[16px] font-semibold text-ink-900 tnum">
                {d.booked}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">Còn trống</dt>
              <dd className="mt-0.5 text-[16px] font-semibold text-ink-900 tnum">
                {d.free}
              </dd>
            </div>
            <div>
              <dt className="text-ink-500">Đã chặn</dt>
              <dd className="mt-0.5 text-[16px] font-semibold text-ink-900 tnum">
                {d.blocked}
              </dd>
            </div>
          </dl>
        </div>

        {/* One bar, three segments, in the order the numbers above read. */}
        <div
          className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-sand-200"
          role="img"
          aria-label={`${d.booked} phòng đã đặt, ${d.blocked} phòng đã chặn, ${d.free} phòng còn trống trên tổng ${d.roomCount}`}
        >
          <span
            className="bg-ink-900"
            style={{ width: `${(d.booked / d.roomCount) * 100}%` }}
          />
          <span
            className="bg-ink-300"
            style={{ width: `${(d.blocked / d.roomCount) * 100}%` }}
          />
        </div>
      </section>

      {/* ---- movements ---------------------------------------------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {[
          { title: "Khách đến", list: d.arrivals, empty: "Không có ai nhận phòng." },
          { title: "Khách đi", list: d.departures, empty: "Không có ai trả phòng." },
        ].map((col) => (
          <section
            key={col.title}
            className="rounded-2xl border border-line bg-surface p-6"
          >
            <h2 className="text-[15px] font-semibold text-ink-900">{col.title}</h2>
            {col.list.length === 0 ? (
              <p className="mt-3 text-[14px] text-ink-500">{col.empty}</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {col.list.map((m) => (
                  <li
                    key={`${m.roomName}-${m.guestName}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="text-[14px] font-medium text-ink-900">
                      {m.guestName}
                    </span>
                    <span className="text-[13px] text-ink-500">
                      {m.roomName} · <span className="tnum">{m.guests}</span> khách
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {col.title === "Khách đi" && d.roomsNeedingClean > 0 ? (
              <Link
                href="/buong-phong"
                className="mt-4 inline-flex min-h-11 items-center text-[14px] font-semibold text-ink-900 underline underline-offset-4"
              >
                {d.roomsNeedingClean} phòng cần dọn →
              </Link>
            ) : null}
          </section>
        ))}
      </div>

      {/* ---- forecast ------------------------------------------------------ */}
      <section className="mt-5 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink-900">Dự báo 14 ngày</h2>
          <p className="text-[13px] text-ink-600">
            Trung bình{" "}
            <span className="font-semibold text-ink-900 tnum">
              {d.forecastAverage}%
            </span>{" "}
            ·{" "}
            <span className="tnum">
              {formatVnd(d.forecast.reduce((s, f) => s + f.revenue, 0))}
            </span>
          </p>
        </div>

        <ul className="mt-5 flex items-end gap-1.5 overflow-x-auto pb-1">
          {d.forecast.map((f) => (
            <li key={f.date.toISOString()} className="flex-1 min-w-11 text-center">
              {/* Bar height tracks revenue, the label tracks occupancy: the two
                  come apart when a cheap room fills and an expensive one does
                  not, which is exactly the week worth noticing. */}
              <div className="flex h-24 items-end justify-center">
                <span
                  className={`w-full rounded-t ${
                    f.occupancy > 0 ? "bg-ink-900" : "bg-sand-200"
                  }`}
                  style={{
                    height: `${Math.max(4, (f.revenue / maxRevenue) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] font-medium text-ink-700 tnum">
                {f.occupancy}%
              </p>
              <p className="text-[10.5px] text-ink-400">
                {weekdayShortVi(f.date)} {f.date.getUTCDate()}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-4 border-t border-line pt-4 text-[12.5px] leading-relaxed text-ink-500">
          Cột cao theo doanh thu, con số theo tỷ lệ lấp đầy. Hai thứ này tách
          nhau khi phòng rẻ kín mà phòng đắt trống — đó chính là tuần đáng để ý.
          Lượt đặt chưa nhập giá tính theo giá niêm yết của phòng; phòng chưa có
          giá không đóng góp gì.
        </p>
      </section>
    </>
  );
}
