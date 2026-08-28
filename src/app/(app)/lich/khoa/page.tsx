import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { canManageBookings, requireMember, visiblePropertyFilter } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { addDays, parseIsoDate, todayIn, toIsoDate } from "@/lib/dates";

import { BlockForm } from "./BlockForm";
import { createBlock } from "../actions";

export const metadata: Metadata = { title: "Khóa đêm" };

export default async function NewBlockPage(props: PageProps<"/lich/khoa">) {
  const member = await requireMember();
  if (!canManageBookings(member)) redirect("/lich");

  const params = await props.searchParams;

  const rooms = await withOrg(member.orgId, (tx) =>
    tx.room.findMany({
      where: { property: visiblePropertyFilter(member) },
      select: { id: true, name: true, property: { select: { name: true } } },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    }),
  );

  if (rooms.length === 0) redirect("/cho-nghi/moi");

  const today = todayIn(member.timezone);
  const requested = typeof params.from === "string" ? parseIsoDate(params.from) : null;
  const from = requested ?? today;

  const wanted = typeof params.room === "string" ? params.room : null;
  const defaultRoomId = rooms.find((r) => r.id === wanted)?.id ?? rooms[0].id;

  return (
    <>
      <Link href="/lich" className="text-[14px] font-medium text-ink-500 hover:text-ink-900">
        ← Về lịch
      </Link>
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight text-ink-900">
        Khóa đêm
      </h1>
      <p className="mb-7 mt-1 max-w-xl text-[14px] leading-relaxed text-ink-600">
        Giữ phòng lại cho bảo trì hoặc cho chính bạn ở. Đêm bị khóa không nhận
        đặt phòng, và cũng không tính vào tỷ lệ lấp đầy.
      </p>

      <BlockForm
        action={createBlock}
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          propertyName: r.property.name,
        }))}
        defaultRoomId={defaultRoomId}
        defaultFrom={toIsoDate(from)}
        defaultTo={toIsoDate(addDays(from, 1))}
      />
    </>
  );
}
