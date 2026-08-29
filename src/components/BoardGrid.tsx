import Link from "next/link";

import type { Board } from "@/lib/board";
import { SOURCE_LABELS } from "@/lib/board";
import { dayOfMonth, isWeekend, toIsoDate, weekday } from "@/lib/dates";
import { fill, makeT, type Locale, type T } from "@/lib/i18n";
import { dictFor } from "@/lib/locale";
import { EmptyState } from "@/components/EmptyState";

/**
 * The board: rooms down, days across, stays drawn over the day cells.
 *
 * Stays are absolutely positioned rather than placed into grid cells. A stay
 * covers several days, and grid placement would either forbid the overlap that
 * back-to-back bookings need at their shared edge, or force one row per
 * booking. Positioning by column index keeps one row per room, which is what a
 * host is actually scanning.
 */

const NAME_COL = "13rem";
const DAY_COL = "3.25rem";

function StayBar({
  span,
  t,
}: {
  span: Board["rooms"][number]["spans"][number];
  t: T;
}) {
  const booking = span.kind === "booking";

  const inner = [
    "flex h-full items-center gap-1.5 overflow-hidden rounded-lg px-2 text-[12px] font-medium",
    span.openStart ? "stay--open-start" : "",
    span.openEnd ? "stay--open-end" : "",
    booking
      ? "bg-ink-900 text-sand-100 transition-colors hover:bg-ink-700"
      : "border border-dashed border-ink-400 bg-sand-200 text-ink-700",
  ].join(" ");

  // The bar shows a name; the tooltip carries what will not fit in a two-night
  // bar. Both are also in the visually hidden summary below the board, so this
  // is convenience rather than the only route to the information.
  const tooltip = `${span.label} · ${fill(t("{n} đêm"), { n: span.nights })}${
    span.source ? ` · ${t(SOURCE_LABELS[span.source] ?? span.source)}` : ""
  }`;

  return (
    <div
      className="absolute inset-y-1 px-0.5"
      style={{
        left: `calc(${span.offset} * ${DAY_COL})`,
        width: `calc(${span.span} * ${DAY_COL})`,
      }}
    >
      {/* Two branches rather than one polymorphic tag. A booking opens its own
          page; a block has nothing behind it to edit, so it stays a plain div
          rather than a link that goes nowhere. Written out because Link's href
          is required, and a component that is sometimes a Link and sometimes a
          div cannot satisfy that with a spread. */}
      {booking ? (
        <Link href={`/lich/dat-phong/${span.id}`} className={inner} title={tooltip}>
          <span className="truncate">{span.label}</span>
        </Link>
      ) : (
        <div className={inner} title={tooltip}>
          <span className="truncate">{span.label}</span>
        </div>
      )}
    </div>
  );
}

export function BoardGrid({
  board,
  today,
  locale = "vi",
}: {
  board: Board;
  today: string;
  locale?: Locale;
}) {
  // Derived from the locale it was handed rather than read from the cookie:
  // this is a component, not a page, and it renders once per calendar view.
  const t = makeT(dictFor(locale));
  const todayIndex = board.days.findIndex((d) => toIsoDate(d) === today);

  if (board.rooms.length === 0) {
    return (
      <EmptyState
        title={t("Chưa có phòng nào")}
        description={t("Bảng lịch cần ít nhất một phòng để có gì mà hiển thị. Thêm chỗ nghỉ đầu tiên rồi quay lại đây.")}
        actionLabel={t("Thêm chỗ nghỉ")}
        actionHref="/cho-nghi/moi"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      {/* The only horizontally scrolling element on the page. The room-name
          column is sticky inside it, so it stays put as the dates move. */}
      <div className="overflow-x-auto">
        <div
          className="board min-w-max"
          style={
            {
              "--board-name-col": NAME_COL,
              "--board-day-col": DAY_COL,
              "--board-days": board.days.length,
            } as React.CSSProperties
          }
        >
          {/* Header ------------------------------------------------------ */}
          <div className="board__sticky border-b border-r border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {t("Phòng")}
          </div>

          {board.days.map((day, i) => (
            <div
              key={toIsoDate(day)}
              className={[
                "border-b border-line px-1 py-2 text-center",
                i === todayIndex
                  ? "bg-clay-50"
                  : isWeekend(day)
                    ? "bg-sand-50"
                    : "",
              ].join(" ")}
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-400">
                {weekday(day, locale)}
              </div>
              <div
                className={[
                  "text-[13px] tnum",
                  i === todayIndex
                    ? "font-bold text-clay-600"
                    : "font-medium text-ink-700",
                ].join(" ")}
              >
                {dayOfMonth(day)}
              </div>
            </div>
          ))}

          {/* Rows -------------------------------------------------------- */}
          {board.rooms.map((room) => (
            <div key={room.id} className="contents">
              <div className="board__sticky border-b border-r border-line px-4 py-2.5">
                <p className="truncate text-[13px] font-semibold text-ink-900">
                  {room.name}
                </p>
                <p className="truncate text-[11px] text-ink-500">
                  {room.propertyName}
                </p>
              </div>

              {/* One cell per day for the ruling, then the stays laid over
                  the whole strip. The stays live in the first cell, which is
                  `position: relative` and spans the rest — hence the explicit
                  grid-column below rather than another wrapper element. */}
              <div
                className="board__row border-b border-line"
                style={{ gridColumn: `2 / span ${board.days.length}` }}
              >
                <div
                  className="grid h-full"
                  style={{
                    gridTemplateColumns: `repeat(${board.days.length}, ${DAY_COL})`,
                  }}
                >
                  {board.days.map((day, i) => (
                    <Link
                      key={toIsoDate(day)}
                      href={`/lich/moi?room=${room.id}&from=${toIsoDate(day)}`}
                      aria-label={`Thêm đặt phòng — ${room.name}, ${toIsoDate(day)}`}
                      className={[
                        "h-11 border-r border-line/60 transition-colors last:border-r-0 hover:bg-clay-50",
                        i === todayIndex
                          ? "bg-clay-50/60"
                          : isWeekend(day)
                            ? "bg-sand-50/60"
                            : "",
                      ].join(" ")}
                    />
                  ))}
                </div>

                {room.spans.map((span) => (
                  <StayBar key={`${span.kind}-${span.id}`} span={span} t={t} />
                ))}
              </div>
            </div>
          ))}

          {/* Occupancy, one column per day. Sits under the rooms so the eye
              lands on it after scanning the grid, which is the order a host
              reads in: what is booked, then how full that leaves the night. */}
          <div className="board__sticky border-t border-line px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {t("Lấp đầy")}
          </div>
          {board.perDay.map((day, i) => (
            <div
              key={`occ-${toIsoDate(board.days[i])}`}
              className={[
                "border-t border-line px-1 py-2 text-center",
                i === todayIndex ? "bg-clay-50" : isWeekend(board.days[i]) ? "bg-sand-50" : "",
              ].join(" ")}
            >
              <div
                className={`text-[12px] font-semibold tnum ${
                  day.sold === 0 ? "text-ink-300" : "text-ink-900"
                }`}
              >
                {day.total === 0 ? "—" : `${Math.round((day.sold / day.total) * 100)}%`}
              </div>
              <div className="text-[10px] text-ink-400 tnum">
                {day.sold}/{day.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The board is a picture. This is the same information as a list, for
          anyone using a screen reader — for whom a grid of absolutely
          positioned bars is close to unreadable. */}
      <div className="sr-only">
        <h2>{t("Danh sách đặt phòng trong khoảng đang xem")}</h2>
        <ul>
          {board.rooms.flatMap((room) =>
            room.spans.map((span) => (
              <li key={`${room.id}-${span.kind}-${span.id}`}>
                {span.kind === "booking" ? (
                  <Link href={`/lich/dat-phong/${span.id}`}>
                    {room.propertyName} — {room.name}: {span.label},{" "}
                    {fill(t("{n} đêm"), { n: span.nights })}
                    {span.source
                      ? `, ${t(SOURCE_LABELS[span.source] ?? span.source)}`
                      : ""}
                  </Link>
                ) : (
                  <>
                    {room.propertyName} — {room.name}: {span.label},{" "}
                    {fill(t("{n} đêm"), { n: span.nights })}
                  </>
                )}
              </li>
            )),
          )}
        </ul>
      </div>
    </div>
  );
}
