import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { BookingForm } from "@/components/BookingForm";
import { SOURCE_LABELS } from "@/lib/board";
import { canEditBooking, canManageBookings, orgCurrency, requireMember, visiblePropertyFilter } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { daysBetween, formatMoney, shortVi, toIsoDate } from "@/lib/dates";

import { cancelBooking, updateBooking } from "../../actions";
import { getT, readLocale } from "@/lib/locale";
import { fill } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Sửa đặt phòng") };
}

export default async function BookingPage(
  props: PageProps<"/lich/dat-phong/[id]">,
) {
  const t = await getT();
  const locale = await readLocale();
  const member = await requireMember();
  const currency = await orgCurrency();
  if (!canManageBookings(member)) redirect("/lich");

  const { id } = await props.params;

  const data = await withOrg(member.orgId, async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      select: {
        id: true,
        roomId: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        checkIn: true,
        checkOut: true,
        guests: true,
        totalCents: true,
        source: true,
        status: true,
        notes: true,
        createdByMembershipId: true,
        createdAt: true,
        createdBy: { select: { user: { select: { name: true } } } },
      },
    });

    if (!booking) return null;

    const rooms = await tx.room.findMany({
      where: { property: visiblePropertyFilter(member) },
      select: { id: true, name: true, property: { select: { name: true } } },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });

    return { booking, rooms };
  });

  // Row-level security means a booking in another organization simply is not
  // found. "Not yours" and "does not exist" deliberately look the same.
  if (!data) notFound();

  const { booking, rooms } = data;
  const editable = canEditBooking(member, booking.createdByMembershipId);
  const nights = daysBetween(booking.checkIn, booking.checkOut);
  const cancelled = booking.status === "CANCELLED";

  return (
    <>
      <Link
        href={`/lich?tu=${toIsoDate(booking.checkIn)}`}
        className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
      >
        {t("← Về lịch")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">
            {booking.guestName}
          </h1>
          <p className="mt-1 text-[14px] text-ink-600">
            {shortVi(booking.checkIn)} – {shortVi(booking.checkOut)} ·{" "}
            <span className="tnum">{fill(t("{n} đêm"), { n: nights })}</span> ·{" "}
            {t(SOURCE_LABELS[booking.source] ?? booking.source)}
            {booking.totalCents !== null ? (
              <>
                {" · "}
                <span className="tnum font-medium text-ink-900">
                  {formatMoney(booking.totalCents, currency, locale)}
                </span>
              </>
            ) : null}
          </p>
          <p className="mt-1 text-[13px] text-ink-500">
            {fill(t("Tạo bởi {ai}"), {
              ai: booking.createdBy?.user.name ?? t("đồng bộ tự động"),
            })}{" "}
            ·{" "}
            {shortVi(booking.createdAt)}
          </p>
        </div>

        {cancelled ? (
          <span className="rounded-full bg-danger-soft px-3 py-1.5 text-[12px] font-semibold text-danger">
            {t("Đã hủy")}
          </span>
        ) : null}
      </div>

      {cancelled ? (
        <p className="mt-6 max-w-xl rounded-xl border border-line bg-sand-50 px-4 py-3 text-[14px] leading-relaxed text-ink-600">
          {t("Đặt phòng này đã hủy, nên những đêm của nó đã trống trở lại. Bản ghi vẫn được giữ. Lưu lại bên dưới sẽ đưa nó về lịch — nếu những đêm đó chưa có người khác giữ.")}
        </p>
      ) : null}

      {!editable ? (
        <p className="mt-6 max-w-xl rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-[14px] leading-relaxed text-warning">
          {t("Đặt phòng này do người khác tạo. Bạn xem được nhưng chưa được cấp quyền sửa.")}
        </p>
      ) : (
        <div className="mt-7">
          <BookingForm
            action={updateBooking}
            bookingId={booking.id}
            rooms={rooms.map((r) => ({
              id: r.id,
              name: r.name,
              propertyName: r.property.name,
            }))}
            defaults={{
              roomId: booking.roomId,
              checkIn: toIsoDate(booking.checkIn),
              checkOut: toIsoDate(booking.checkOut),
              guestName: booking.guestName,
              guestEmail: booking.guestEmail ?? "",
              guestPhone: booking.guestPhone ?? "",
              guests: booking.guests,
              totalCents: booking.totalCents?.toString() ?? "",
              source: booking.source,
              notes: booking.notes ?? "",
            }}
            submitLabel={t("Lưu thay đổi")}
            cancelHref={`/lich?tu=${toIsoDate(booking.checkIn)}`}
          />

          {!cancelled ? (
            <form action={cancelBooking} className="mt-10 max-w-xl border-t border-line pt-6">
              <input type="hidden" name="id" value={booking.id} />
              <p className="text-[14px] font-medium text-ink-900">{t("Hủy đặt phòng")}</p>
              <p className="mb-3 mt-1 text-[13px] leading-relaxed text-ink-500">
                {t("Những đêm này sẽ trống trở lại ngay. Bản ghi vẫn được giữ, không bị xóa.")}
              </p>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-full border border-danger/40 px-5 text-[14px] font-semibold text-danger hover:bg-danger-soft"
              >
                {t("Hủy đặt phòng này")}
              </button>
            </form>
          ) : null}
        </div>
      )}
    </>
  );
}
