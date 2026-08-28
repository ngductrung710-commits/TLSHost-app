import type { Metadata } from "next";
import Link from "next/link";

import { BoardGrid } from "@/components/BoardGrid";
import { loadBoard } from "@/lib/board";
import { requireMember } from "@/lib/dal";
import { addDays, parseIsoDate, shortVi, todayIn, toIsoDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Lịch" };

/** How many days fit before the board needs scrolling on a laptop. */
const WINDOW_DAYS = 21;

export default async function CalendarPage(props: PageProps<"/lich">) {
  const member = await requireMember();
  const params = await props.searchParams;

  const today = todayIn(member.timezone);

  // The window start comes from the URL so a particular week is a link a host
  // can send to someone. An unparseable value falls back to today rather than
  // erroring — a mistyped date in a query string is not worth a 500.
  const requested = typeof params.tu === "string" ? parseIsoDate(params.tu) : null;
  const from = requested ?? today;

  const board = await loadBoard(member, from, WINDOW_DAYS);

  const prev = toIsoDate(addDays(from, -WINDOW_DAYS));
  const next = toIsoDate(addDays(from, WINDOW_DAYS));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
            Lịch
          </h1>
          <p className="mt-1 text-[14px] text-ink-600">
            {board.rooms.length} phòng · {shortVi(board.from)} –{" "}
            {shortVi(addDays(board.to, -1))} ·{" "}
            <span className="tnum font-medium text-ink-900">
              lấp đầy {board.occupancy}%
            </span>
          </p>
        </div>

        <nav aria-label="Chuyển khoảng ngày" className="flex items-center gap-2">
          <Link
            href={`/lich?tu=${prev}`}
            className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-[14px] font-medium text-ink-700 hover:bg-sand-50"
          >
            ← Trước
          </Link>
          <Link
            href="/lich"
            className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-[14px] font-medium text-ink-700 hover:bg-sand-50"
          >
            Hôm nay
          </Link>
          <Link
            href={`/lich?tu=${next}`}
            className="flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-[14px] font-medium text-ink-700 hover:bg-sand-50"
          >
            Sau →
          </Link>
        </nav>
      </div>

      <div className="mt-6">
        <BoardGrid board={board} today={toIsoDate(today)} />
      </div>

      <p className="mt-4 text-[13px] text-ink-500">
        Bấm vào một ô trống để thêm đặt phòng cho phòng và ngày đó.
      </p>
    </>
  );
}
