import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { BoardGrid } from "@/components/BoardGrid";
import { SOURCE_LABELS, loadBoard } from "@/lib/board";
import { findBookings } from "@/lib/search";
import { requireMember } from "@/lib/dal";
import {
  addDays,
  parseIsoDate,
  shortVi,
  todayIn,
  toIsoDate,
} from "@/lib/dates";

import { deleteBlock } from "./actions";
import { getT, readLocale } from "@/lib/locale";
import { fill } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Lịch") };
}

/** How many days fit before the board needs scrolling on a laptop. */
const WINDOW_DAYS = 21;

export default async function CalendarPage(props: PageProps<"/lich">) {
  const t = await getT();
  const locale = await readLocale();
  const member = await requireMember();
  // Housekeepers see rooms, never bookings: the calendar names every guest,
  // and the spec is explicit that they should not see guest or payment detail.
  // Their screen is the housekeeping board.
  if (member.role === "HOUSEKEEPER") redirect("/buong-phong");
  const params = await props.searchParams;

  const today = todayIn(member.timezone);

  // The window start comes from the URL so a particular week is a link a host
  // can send to someone. An unparseable value falls back to today rather than
  // erroring — a mistyped date in a query string is not worth a 500.
  const requested =
    typeof params.tu === "string" ? parseIsoDate(params.tu) : null;
  const from = requested ?? today;

  // A search replaces the board rather than filtering it. The board is laid
  // out by room and date; a list of three guests laid out that way is three
  // rows of mostly empty grid.
  const query = typeof params.tim === "string" ? params.tim : "";
  const hits = query.trim() ? await findBookings(member, query) : null;

  const board = await loadBoard(member, from, WINDOW_DAYS);

  const prev = toIsoDate(addDays(from, -WINDOW_DAYS));
  const next = toIsoDate(addDays(from, WINDOW_DAYS));

  // Flattened out of the board rather than fetched again: loadBoard already
  // read every block touching this window, and the list below only needs a
  // name and a length.
  const blocks = board.rooms.flatMap((room) =>
    room.spans
      .filter((span) => span.kind === "block")
      .map((span) => ({
        id: span.id,
        roomName: room.name,
        label: span.label,
        nights: span.nights,
      })),
  );

  return (
    <>
      {/* Full-bleed: the toolbar is a rule across the whole pane, so it has to
          undo the padding <main> puts on every other screen. */}
      <div className="-mx-4 -mt-4 mb-4 flex flex-wrap items-center gap-2 border-b border-line bg-surface px-4 py-2.5 sm:-mx-5 sm:px-5">
        <nav aria-label={t("Chuyển khoảng ngày")} className="flex items-center gap-1">
          <Link
            href={`/lich?tu=${prev}`}
            aria-label={t("← Trước")}
            className="grid size-9 place-items-center rounded-full border border-line text-ink-700 hover:bg-sand-50"
          >
            <span aria-hidden="true">‹</span>
          </Link>
          <Link
            href="/lich"
            className="flex h-9 items-center rounded-full border border-line px-4 text-[13px] font-semibold text-ink-800 hover:bg-sand-50"
          >
            {t("Hôm nay")}
          </Link>
          <Link
            href={`/lich?tu=${next}`}
            aria-label={t("Sau →")}
            className="grid size-9 place-items-center rounded-full border border-line text-ink-700 hover:bg-sand-50"
          >
            <span aria-hidden="true">›</span>
          </Link>
        </nav>

        <h1 className="ml-1 text-[15px] font-semibold text-ink-900">
          {shortVi(board.from)} – {shortVi(addDays(board.to, -1))}
        </h1>

        <p className="text-[13px] text-ink-500">
          {fill(t("{n} phòng"), { n: board.rooms.length })} ·{" "}
          <span className="tnum font-medium text-ink-700">
            {fill(t("lấp đầy {n}%"), { n: board.occupancy })}
          </span>
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* A GET form, so a search is a URL: it survives a refresh, it can be
              sent to someone, and the back button leaves it. */}
          <form method="get" className="relative">
            <label htmlFor="tim" className="sr-only">
              {t("Tìm khách hoặc mã đặt")}
            </label>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            >
              <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4" />
            </svg>
            <input
              id="tim"
              name="tim"
              type="search"
              defaultValue={query}
              placeholder={t("Tìm khách hoặc mã đặt")}
              className="h-9 w-56 rounded-full border border-line bg-white pl-9 pr-3 text-[13px] text-ink-900 outline-none placeholder:text-ink-400 focus-visible:border-ink-900"
            />
          </form>
          <Link
            href="/ban-hang"
            className="flex h-9 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-50"
          >
            {t("Tìm phòng trống")}
          </Link>
          <Link
            href="/lich/khoa"
            className="flex h-9 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-50"
          >
            {t("Khóa đêm")}
          </Link>
          <Link
            href="/lich/moi"
            className="flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-dark"
          >
            <span aria-hidden="true" className="text-[15px] leading-none">+</span>
            {t("Đặt phòng mới")}
          </Link>
        </div>
      </div>

      {hits ? (
        <section aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink-900">
              {fill(t("{n} kết quả cho “{tim}”"), { n: hits.length, tim: query })}
            </h2>
            <Link
              href="/lich"
              className="text-[13px] font-medium text-ink-600 hover:text-ink-900"
            >
              {t("Xóa tìm kiếm")}
            </Link>
          </div>

          {hits.length === 0 ? (
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink-500">
              {t("Không tìm thấy lượt đặt nào. Thử tên khách, số điện thoại, hoặc vài ký tự cuối của mã đặt.")}
            </p>
          ) : (
            <ul className="mt-3 card divide-y divide-line">
              {hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    href={`/lich/dat-phong/${hit.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-sand-50"
                  >
                    <span className="min-w-40 flex-1">
                      <span className="block text-[14px] font-medium text-ink-900">
                        {hit.guestName}
                        {hit.status === "CANCELLED" ? (
                          <span className="ml-2 rounded-full bg-sand-200 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                            {t("Đã hủy")}
                          </span>
                        ) : null}
                      </span>
                      <span className="block text-[12.5px] text-ink-500">
                        {hit.propertyName} · {hit.roomName}
                        {hit.guestPhone ? ` · ${hit.guestPhone}` : ""}
                      </span>
                    </span>
                    <span className="text-[13px] text-ink-600 tnum">
                      {shortVi(hit.checkIn)} – {shortVi(hit.checkOut)}
                    </span>
                    <span className="text-[12.5px] text-ink-500">
                      {t(SOURCE_LABELS[hit.source] ?? hit.source)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <div>
            <BoardGrid board={board} today={toIsoDate(today)} locale={locale} />
          </div>

          <p className="mt-4 text-[13px] text-ink-500">
            {t("Bấm vào một ô trống để thêm đặt phòng, bấm vào một lượt đặt để sửa.")}
          </p>
        </>
      )}

      {/* Blocks have no page of their own — there is nothing to edit on one
          beyond removing it. Rather than a route for that, they are listed
          here, derived from the board that was already loaded. */}
      {blocks.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-[14px] font-semibold text-ink-900">
            {t("Đêm đang khóa trong khoảng này")}
          </h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            {blocks.map((block) => (
              <li
                key={block.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-[14px] text-ink-700">
                  <span className="font-medium text-ink-900">
                    {block.roomName}
                  </span>{" "}
                  · {block.label} ·{" "}
                  <span className="tnum">{fill(t("{n} đêm"), { n: block.nights })}</span>
                </span>
                <form action={deleteBlock}>
                  <input type="hidden" name="id" value={block.id} />
                  <button
                    type="submit"
                    className="flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-danger hover:bg-danger-soft"
                  >
                    {t("Bỏ khóa")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
