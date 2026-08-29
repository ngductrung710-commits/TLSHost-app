import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  canManageBookings,
  requireMember,
  visiblePropertyFilter,
} from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { addDays, parseIsoDate, todayIn, toIsoDate } from "@/lib/dates";

import { BookingForm } from "@/components/BookingForm";

import { createBooking } from "../actions";
import { getT } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Đặt phòng mới") };
}

export default async function NewBookingPage(props: PageProps<"/lich/moi">) {
  const t = await getT();
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
  const requested =
    typeof params.from === "string" ? parseIsoDate(params.from) : null;
  const checkIn = requested ?? today;

  // The sales screen sends the whole enquiry through: dates and headcount as
  // the guest gave them. Anything it does not send falls back to what this
  // page used before — two nights for two people.
  const requestedOut =
    typeof params.to === "string" ? parseIsoDate(params.to) : null;
  const checkOut =
    requestedOut && requestedOut > checkIn ? requestedOut : addDays(checkIn, 2);

  const askedGuests = Number(
    typeof params.guests === "string" ? params.guests : NaN,
  );
  const guests =
    Number.isInteger(askedGuests) && askedGuests > 0 && askedGuests <= 30
      ? askedGuests
      : 2;

  // The room named in the query string, but only if it is one this member can
  // actually see. A room id belonging to someone else is not an error worth
  // reporting — it is simply a value to ignore.
  const wanted = typeof params.room === "string" ? params.room : null;
  const defaultRoomId = rooms.find((r) => r.id === wanted)?.id ?? rooms[0].id;

  return (
    <>
      <Link
        href="/lich"
        className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
      >
        {t("← Về lịch")}
      </Link>
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight text-ink-900">
        {t("Đặt phòng mới")}
      </h1>
      <p className="mb-7 mt-1 text-[14px] text-ink-600">
        {t("Nếu những đêm này đã có người giữ, hệ thống sẽ từ chối và nói rõ ai đang giữ.")}
      </p>

      <BookingForm
        action={createBooking}
        rooms={rooms.map((r) => ({
          id: r.id,
          name: r.name,
          propertyName: r.property.name,
        }))}
        defaults={{
          roomId: defaultRoomId,
          checkIn: toIsoDate(checkIn),
          checkOut: toIsoDate(checkOut),
          guestName: "",
          guestEmail: "",
          guestPhone: "",
          guests,
          totalCents: "",
          source: "DIRECT",
          notes: "",
        }}
        submitLabel={t("Tạo đặt phòng")}
        cancelHref="/lich"
      />
    </>
  );
}
