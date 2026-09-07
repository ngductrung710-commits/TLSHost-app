import Link from "next/link";

import type { Board } from "@/lib/board";
import { SOURCE_LABELS } from "@/lib/board";
import { dayOfMonth, isWeekend, toIsoDate, weekdayLong } from "@/lib/dates";
import { fill, makeT, type Locale, type T } from "@/lib/i18n";
import { dictFor } from "@/lib/locale";
import { EmptyState } from "@/components/EmptyState";
import { AddRoomPanel } from "@/components/AddRoomPanel";
import { DayStrip } from "@/components/DayStrip";
import { BookingBar } from "@/components/BookingBar";
import { RoomGroup } from "@/components/RoomGroup";
import { RoomNameCell } from "@/components/RoomNameCell";

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
// Đi từ 3.25rem lên 4.25rem rồi lên 6.5rem, mỗi lần vì cùng một lý do: một ô
// hẹp không chứa nổi thứ nó phải chứa. Ở 3.25rem thì tên khách trên thanh đặt
// phòng bị cắt cụt; ở 4.25rem thì đọc được nhưng bảng vẫn dày đặc, chín ngày
// bị nhồi thành mười bốn.
//
// 6.5rem × 9 ngày = 936px, cộng cột tên 13rem là vừa một màn 1366 mà không
// phải cuộn ngang. Ít ngày hơn nhưng mỗi ngày đọc được — và mũi tên ‹ › với
// bộ chọn tháng đã lo phần đi xa.
const DAY_COL = "6.5rem";

/** Một đêm bị khóa — không phải một lượt đặt, nên không có thẻ và không có
    trang phía sau để mở. Giữ nguyên kiểu viền đứt cũ. */
function BlockBar({
  span,
  days,
  t,
}: {
  span: Board["rooms"][number]["spans"][number];
  days: number;
  t: T;
}) {
  const inner = [
    "flex h-full items-center gap-1.5 overflow-hidden rounded-lg px-2 text-[12px] font-medium",
    span.openStart ? "stay--open-start" : "",
    span.openEnd ? "stay--open-end" : "",
    "border border-dashed border-ink-400 bg-sand-200 text-ink-700",
  ].join(" ");

  const tooltip = `${span.label} · ${fill(t("{n} đêm"), { n: span.nights })}`;

  return (
    <div
      className="absolute inset-y-1 px-0.5"
      style={{
        left: `${(span.offset / days) * 100}%`,
        width: `${(span.span / days) * 100}%`,
      }}
    >
      <div className={inner} title={tooltip}>
        <span className="truncate">{span.label}</span>
      </div>
    </div>
  );
}

export function BoardGrid({
  board,
  today,
  locale = "vi",
  renameAction,
  addRoomAction,
  currency,
  canRename,
  statusAction,
  payAction,
}: {
  board: Board;
  today: string;
  locale?: Locale;
  renameAction: (formData: FormData) => Promise<void>;
  addRoomAction: (
    prev: { error: string | null; notice?: string },
    formData: FormData,
  ) => Promise<{ error: string | null; notice?: string }>;
  /** Ký hiệu tiền tệ của tổ chức, cho ô giá trong ngăn kéo. */
  currency: string;
  /** Chỉ chủ nhà thêm/đổi tên phòng; những vai khác chỉ đọc. */
  canRename: boolean;
  // Server action cho thẻ đơn: dời trạng thái, và ghi nhận thanh toán. Truyền
  // xuống chứ không để BookingBar import — xem chú thích trong BookingBar.
  statusAction: (
    prev: { error: string | null },
    fd: FormData,
  ) => Promise<{ error: string | null }>;
  payAction: (
    prev: { error: string | null },
    fd: FormData,
  ) => Promise<{ error: string | null }>;
}) {
  // Derived from the locale it was handed rather than read from the cookie:
  // this is a component, not a page, and it renders once per calendar view.
  const t = makeT(dictFor(locale));
  const todayIndex = board.days.findIndex((d) => toIsoDate(d) === today);

  /**
   * Gom phòng theo cơ sở, giữ nguyên thứ tự loadBoard đã sắp.
   *
   * Gom ở đây chứ không vừa duyệt vừa đoán chỗ bắt đầu nhóm như trước: một
   * nhóm thu gọn được cần biết trước nó có bao nhiêu hàng và những hàng nào,
   * mà cách cũ chỉ nhìn được hàng liền trước.
   */
  const groups: { id: string; name: string; rooms: Board["rooms"] }[] = [];
  for (const room of board.rooms) {
    const last = groups[groups.length - 1];
    if (last && last.id === room.propertyId) last.rooms.push(room);
    else groups.push({ id: room.propertyId, name: room.propertyName, rooms: [room] });
  }

  if (board.rooms.length === 0) {
    return (
      <EmptyState
        title={t("Chưa có phòng nào")}
        description={t("Bảng lịch cần ít nhất một phòng để có gì mà hiển thị. Thêm cơ sở đầu tiên rồi quay lại đây.")}
        actionLabel={t("Thêm cơ sở")}
        actionHref="/cho-nghi/moi"
      />
    );
  }

  return (
    // relative không phải để trang trí: bản tóm tắt sr-only ở cuối là
    // position:absolute, và nếu không có tổ tiên nào được định vị thì nó neo
    // vào gốc trang. Nó vẫn vô hình, nhưng vẫn tính vào vùng cuộn của <html>
    // — đo được 104px khoảng xám thừa dưới đáy trang. Có relative thì
    // overflow-hidden ngay ở đây cắt nó đi.
    <div className="relative overflow-hidden rounded-2xl border border-line bg-surface">
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
              {/* "THỨ 2" chứ không phải "T2". Ô đã rộng 6.5rem, và chữ viết
                  tắt chỉ đáng khi không đủ chỗ cho chữ đầy đủ. */}
              <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-ink-400">
                {weekdayLong(day, locale)}
              </div>
              <div
                className={[
                  "text-[15px] tnum",
                  i === todayIndex
                    ? "font-bold text-clay-600"
                    : "font-medium text-ink-700",
                ].join(" ")}
              >
                {dayOfMonth(day)}
              </div>
            </div>
          ))}

          {/* Lấp đầy, ngay dưới dải ngày ------------------------------------
              Trước đây hàng này nằm dưới đáy, với lý do là mắt nên đọc "đã đặt
              gì" trước rồi mới tới "còn trống bao nhiêu". Lý do đó không sai,
              nhưng nó chỉ đúng khi bảng ngắn: với mười phòng, con số phần trăm
              trôi khỏi màn hình và không ai cuộn xuống để tìm nó. Trên cùng
              thì nó luôn nằm cạnh cái ngày mà nó nói về. */}
          <div className="board__sticky border-b border-r border-line bg-sand-50/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
            {t("Lấp đầy")}
          </div>
          {board.perDay.map((day, i) => (
            <div
              key={`occ-${toIsoDate(board.days[i])}`}
              className={[
                "border-b border-line px-1 py-2 text-center",
                i === todayIndex
                  ? "bg-clay-50"
                  : isWeekend(board.days[i])
                    ? "bg-sand-50"
                    : "bg-sand-50/60",
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

          {/* Rows -------------------------------------------------------- */}
          {groups.map((group) => (
            <RoomGroup
              key={group.id}
              propertyId={group.id}
              name={group.name}
              count={group.rooms.length}
              days={board.days.length}
              addRoom={
                canRename ? (
                  <AddRoomPanel
                    propertyId={group.id}
                    propertyName={group.name}
                    action={addRoomAction}
                    locale={locale}
                    currency={currency}
                    label={t("Thêm phòng")}
                  />
                ) : null
              }
            >
              {group.rooms.map((room) => (
                <div key={room.id} className="contents">
              <div className="board__sticky border-b border-r border-line px-4 py-2.5">
                <RoomNameCell
                  roomId={room.id}
                  name={room.name}
                  action={renameAction}
                  canEdit={canRename}
                />
              </div>

              {/* One cell per day for the ruling, then the stays laid over
                  the whole strip. The stays live in the first cell, which is
                  `position: relative` and spans the rest — hence the explicit
                  grid-column below rather than another wrapper element. */}
              <div
                className="board__row border-b border-line"
                style={{ gridColumn: `2 / span ${board.days.length}` }}
              >
                <DayStrip
                  roomId={room.id}
                  roomName={room.name}
                  days={board.days.map((d) => toIsoDate(d))}
                  todayIndex={todayIndex}
                  weekend={board.days.map((d) => isWeekend(d))}
                />

                {room.spans.map((span) =>
                  span.kind === "booking" ? (
                    <BookingBar
                      key={`booking-${span.id}`}
                      data={{
                        id: span.id,
                        label: span.label,
                        status: span.status,
                        ref: span.ref,
                        source: span.source,
                        checkIn: span.checkIn,
                        checkOut: span.checkOut,
                        nights: span.nights,
                        totalCents: span.totalCents,
                        depositCents: span.depositCents,
                        offset: span.offset,
                        span: span.span,
                        openStart: span.openStart,
                        openEnd: span.openEnd,
                      }}
                      days={board.days.length}
                      roomName={room.name}
                      propertyName={room.propertyName}
                      currency={currency}
                      locale={locale}
                      statusAction={statusAction}
                      payAction={payAction}
                    />
                  ) : (
                    <BlockBar
                      key={`block-${span.id}`}
                      span={span}
                      days={board.days.length}
                      t={t}
                    />
                  ),
                )}
              </div>
                </div>
              ))}
            </RoomGroup>
          ))}

          {/* Lối thêm, ngay trong lưới ------------------------------------
              Chỗ một chủ nhà nghĩ tới việc thiếu một phòng là lúc đang nhìn
              hàng phòng, không phải lúc đang ở trang Cài đặt. */}
          <div className="board__sticky border-r border-line px-2 py-2">
            <Link
              href="/cho-nghi/moi"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900"
            >
              <span aria-hidden="true" className="text-[15px] leading-none">
                +
              </span>
              {t("Thêm cơ sở")}
            </Link>
          </div>
          <div style={{ gridColumn: `2 / span ${board.days.length}` }} />
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
