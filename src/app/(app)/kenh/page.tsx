import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { SOURCE_LABELS } from "@/lib/board";
import { requireMember, visiblePropertyFilter } from "@/lib/dal";
import { withOrg } from "@/lib/db";

import { ConnectForm } from "./ConnectForm";
import {
  connectChannel,
  disconnectChannel,
  enableFeed,
  syncNow,
} from "./actions";
import { getT } from "@/lib/locale";
import { fill, type T } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Kênh bán") };
}

/**
 * "3 phút trước". Coarse on purpose — the exact second means nothing here.
 *
 * Takes t rather than reading the cookie itself: this is called inside a map
 * over channels, and a page that awaited the language once per row would be
 * doing the same lookup a dozen times to get the same answer.
 */
function ago(date: Date, t: T): string {
  const mins = Math.round((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return t("vừa xong");
  if (mins < 60) return fill(t("{n} phút trước"), { n: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return fill(t("{n} giờ trước"), { n: hours });
  return fill(t("{n} ngày trước"), { n: Math.round(hours / 24) });
}

export default async function ChannelsPage() {
  const t = await getT();
  const member = await requireMember();
  // Channel URLs are credentials, and nothing here is a housekeeper's job.
  if (member.role === "HOUSEKEEPER") redirect("/buong-phong");
  const isOwner = member.role === "OWNER";

  const { channels, rooms, runs } = await withOrg(member.orgId, async (tx) => {
    const channels = await tx.channel.findMany({
      select: {
        id: true,
        kind: true,
        label: true,
        importUrl: true,
        lastSyncAt: true,
        lastSyncOk: true,
        heldDeletions: true,
        room: {
          select: {
            id: true,
            name: true,
            icalToken: true,
            property: { select: { name: true } },
          },
        },
        _count: { select: { blocks: true } },
      },
      orderBy: [{ kind: "asc" }],
    });

    const rooms = await tx.room.findMany({
      where: { property: visiblePropertyFilter(member) },
      select: {
        id: true,
        name: true,
        icalToken: true,
        property: { select: { name: true } },
      },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });

    const runs = await tx.syncRun.findMany({
      select: {
        id: true,
        status: true,
        startedAt: true,
        eventsSeen: true,
        eventsApplied: true,
        eventsRemoved: true,
        heldDeletions: true,
        error: true,
        channel: { select: { kind: true, room: { select: { name: true } } } },
      },
      orderBy: { startedAt: "desc" },
      take: 12,
    });

    return { channels, rooms, runs };
  });

  const head = await headers();
  const host = head.get("host") ?? "localhost:3001";
  const proto =
    head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const held = channels.filter((c) => c.heldDeletions > 0);

  return (
    <>
      <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
        {t("Kênh bán")}
      </h1>
      <p className="mt-1 text-[14px] text-ink-600">
        {fill(t("{n} kết nối · đồng bộ hai chiều qua iCal"), {
          n: channels.length,
        })}
      </p>

      {held.length > 0 ? (
        <div
          role="alert"
          className="mt-6 rounded-2xl border border-warning/30 bg-warning-soft px-5 py-4"
        >
          <p className="text-[14px] font-semibold text-warning">
            {fill(t("Có {n} kênh đang giữ lại việc xoá"), { n: held.length })}
          </p>
          <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-ink-700">
            {t("Lần đồng bộ gần nhất thấy nhiều khoảng biến mất cùng lúc, nên không xoá gì cả. Kiểm tra lại trên trang của kênh: nếu đúng là khách đã hủy, bấm Đồng bộ ngay lần nữa để áp dụng.")}
          </p>
        </div>
      ) : null}

      {/* ---- connections ------------------------------------------------ */}
      {channels.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="text-[15px] font-semibold text-ink-900">
            {t("Chưa kết nối kênh nào")}
          </p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink-600">
            {t("Nối lịch của Airbnb, Booking.com hay Agoda vào đây, rồi dán link xuất của bạn ngược lại bên đó. Một đêm bán ở đâu sẽ khoá ở mọi nơi.")}
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink-900">
                  {t(SOURCE_LABELS[c.kind] ?? c.kind)}
                  <span className="font-normal text-ink-500">
                    {" · "}
                    {c.room.property.name} — {c.room.name}
                  </span>
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-500">
                  {c.lastSyncAt
                    ? fill(t("Đồng bộ {khi}"), { khi: ago(c.lastSyncAt, t) })
                    : t("Chưa đồng bộ lần nào")}
                  {" · "}
                  <span className="tnum">{c._count.blocks}</span>{" "}
                  {t("khoảng đang giữ")}
                  {c.label ? ` · ${c.label}` : ""}
                </p>
              </div>

              {c.heldDeletions > 0 ? (
                <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-semibold text-warning">
                  {fill(t("Giữ {n} việc xoá"), { n: c.heldDeletions })}
                </span>
              ) : c.lastSyncOk === false ? (
                <span className="rounded-full bg-danger-soft px-2.5 py-1 text-[11px] font-semibold text-danger">
                  {t("Lỗi")}
                </span>
              ) : c.lastSyncOk ? (
                <span className="rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-positive">
                  {t("Đang chạy")}
                </span>
              ) : null}

              <form action={syncNow}>
                <input type="hidden" name="channelId" value={c.id} />
                <button
                  type="submit"
                  className="flex min-h-11 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-50"
                >
                  {t("Đồng bộ ngay")}
                </button>
              </form>

              {isOwner ? (
                <form action={disconnectChannel}>
                  <input type="hidden" name="channelId" value={c.id} />
                  <button
                    type="submit"
                    className="flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-danger hover:bg-danger-soft"
                  >
                    {t("Ngắt")}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/* ---- export feeds ----------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-[1.25rem] font-semibold text-ink-900">
          {t("Link xuất lịch của bạn")}
        </h2>
        <p className="mb-6 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
          {t("Dán link của một phòng vào phần nhập lịch của từng kênh. Link chỉ nói đêm nào đã kín — không có tên khách, không có giá.")}
        </p>

        <ul className="space-y-3">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="rounded-2xl border border-line bg-surface px-5 py-4"
            >
              <p className="text-[14px] font-semibold text-ink-900">
                {room.property.name} — {room.name}
              </p>
              {room.icalToken ? (
                <input
                  readOnly
                  value={`${origin}/feed/${room.icalToken}`}
                  className="mt-2 block w-full rounded-lg border border-line bg-sand-50 px-3 py-2 font-mono text-[12px] text-ink-700"
                />
              ) : isOwner ? (
                <form action={enableFeed} className="mt-2">
                  <input type="hidden" name="roomId" value={room.id} />
                  <button
                    type="submit"
                    className="flex min-h-11 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-50"
                  >
                    {t("Tạo link xuất")}
                  </button>
                </form>
              ) : (
                <p className="mt-2 text-[13px] text-ink-500">
                  {t("Chưa có link. Nhờ chủ nhà tạo.")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---- connect ---------------------------------------------------- */}
      {isOwner && rooms.length > 0 ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.25rem] font-semibold text-ink-900">
            {t("Kết nối kênh mới")}
          </h2>
          <p className="mb-6 mt-1 max-w-xl text-[14px] leading-relaxed text-ink-600">
            {t("Mỗi phòng nối một link cho mỗi kênh.")}
          </p>
          <ConnectForm
            action={connectChannel}
            rooms={rooms.map((r) => ({
              id: r.id,
              name: r.name,
              propertyName: r.property.name,
            }))}
          />
        </section>
      ) : null}

      {/* ---- history ---------------------------------------------------- */}
      {runs.length > 0 ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.25rem] font-semibold text-ink-900">
            {t("Lần đồng bộ gần đây")}
          </h2>
          <p className="mb-4 mt-1 text-[14px] text-ink-600">
            {t("Khi lịch trông sai, đây là chỗ trả lời đồng bộ đã làm gì.")}
          </p>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
            {runs.map((run) => (
              <li key={run.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      run.status === "OK"
                        ? "bg-positive-soft text-positive"
                        : run.status === "HELD"
                          ? "bg-warning-soft text-warning"
                          : "bg-danger-soft text-danger"
                    }`}
                  >
                    {run.status === "OK"
                      ? "Xong"
                      : run.status === "HELD"
                        ? t("Đã giữ lại")
                        : run.status === "FAILED"
                          ? t("Lỗi")
                          : t("Đang chạy")}
                  </span>
                  <span className="text-[13px] text-ink-700">
                    {t(SOURCE_LABELS[run.channel.kind] ?? run.channel.kind)} ·{" "}
                    {run.channel.room.name}
                  </span>
                  <span className="text-[12.5px] text-ink-500 tnum">
                    {fill(t("{thay} thấy · {ap} áp dụng · {go} gỡ"), {
                      thay: run.eventsSeen,
                      ap: run.eventsApplied,
                      go: run.eventsRemoved,
                    })}
                    {run.heldDeletions > 0
                      ? fill(t(" · {n} giữ lại"), { n: run.heldDeletions })
                      : ""}
                  </span>
                  <span className="ml-auto text-[12.5px] text-ink-400">
                    {ago(run.startedAt, t)}
                  </span>
                </div>
                {run.error ? (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">
                    {run.error}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
