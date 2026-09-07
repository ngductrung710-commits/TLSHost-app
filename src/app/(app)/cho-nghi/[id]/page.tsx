import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { formatMoney, todayIn } from "@/lib/dates";

import { InfoForm } from "./InfoForm";
import { PublicPageForm } from "./PublicPageForm";
import { DeletePropertyForm } from "./DeletePropertyForm";
import { RoomsTab } from "./RoomsTab";
import {
  createRoom,
  deleteProperty,
  deleteRoom,
  publishProperty,
  updateProperty,
  updateRoom,
} from "./actions";

import { getT, readLocale } from "@/lib/locale";
import { currencySymbol } from "@/lib/currencies";
import { fill } from "@/lib/i18n";

/**
 * Năm tab, cùng thứ tự với bản thiết kế được yêu cầu bám theo.
 *
 * Khoá là tiếng Việt vì mọi đường dẫn khác trong ứng dụng cũng vậy — /cho-nghi,
 * /buong-phong, /dat-lai-mat-khau. Một ?tab=photos lạc giữa chúng chỉ nói lên
 * rằng nó được chép từ nơi khác.
 */
const TABS = [
  { key: "thong-tin", label: "Thông tin" },
  { key: "anh", label: "Ảnh" },
  { key: "phong", label: "Phòng" },
  { key: "thanh-toan", label: "Thanh toán" },
  { key: "ota", label: "OTA" },
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Chỗ nghỉ") };
}

export default async function PropertyPage(props: PageProps<"/cho-nghi/[id]">) {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") redirect("/cho-nghi");

  const { id } = await props.params;

  /**
   * Tab nào đang mở, đọc từ địa chỉ trang chứ không từ state.
   *
   * Nghĩa là mỗi tab có một URL thật: gửi link cho người khác thì họ mở đúng
   * tab đó, nút quay lại của trình duyệt đi ngược từng tab, và tải lại trang
   * không văng về tab đầu. Một tab dựng bằng useState thì không thứ nào ở
   * trên còn đúng.
   *
   * Giá trị lạ rơi về "thong-tin" chứ không báo lỗi — ?tab=xyz là địa chỉ ai
   * đó gõ tay, và trả về 404 cho một tham số phụ là phản ứng quá tay.
   */
  const params = await props.searchParams;
  const requested = typeof params.tab === "string" ? params.tab : "";
  const tab = (["thong-tin", "anh", "phong", "thanh-toan", "ota"] as const).includes(
    requested as "thong-tin",
  )
    ? requested
    : "thong-tin";

  const property = await withOrg(member.orgId, (tx) =>
    tx.property.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        address: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        region: true,
        postalCode: true,
        countryCode: true,
        intro: true,
        houseRules: true,
        amenities: true,
        publicSlug: true,
        published: true,
        currency: true,
        rooms: {
          select: {
            id: true,
            name: true,
            description: true,
            capacity: true,
            maxAdults: true,
            maxChildren: true,
            basePrice: true,
            minNights: true,
            maxNights: true,
            amenities: true,
          },
          orderBy: { name: "asc" },
        },
      },
    }),
  );

  if (!property) notFound();

  const head = await headers();
  const host = head.get("host") ?? "localhost:3001";
  const proto =
    head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const unpriced = property.rooms.filter((r) => r.basePrice === null).length;

  // Counted for the delete confirmation. Read here rather than passed down
  // from a cached figure: the number a host is asked to accept has to be the
  // number that is actually there.
  const roomIds = property.rooms.map((r) => r.id);
  const today = todayIn(member.timezone);
  const [bookings, upcoming] = roomIds.length
    ? await withOrg(member.orgId, async (tx) => [
        await tx.booking.count({ where: { roomId: { in: roomIds } } }),
        await tx.booking.count({
          where: {
            roomId: { in: roomIds },
            status: "CONFIRMED",
            // checkOut is exclusive, so a stay ending today has already ended.
            checkOut: { gt: today },
          },
        }),
      ])
    : [0, 0];

  const locale = await readLocale();

  return (
    <>
      <Link
        href="/cho-nghi"
        className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
      >
        {t("← Về danh sách")}
      </Link>

      <h1 className="mt-3 text-[18px] font-semibold text-ink-900">
        {property.name}
      </h1>
      {property.address ? (
        <p className="mt-1 text-[14px] text-ink-600">{property.address}</p>
      ) : null}

      {/* ---- thanh tab --------------------------------------------------- */}
      <nav
        aria-label={t("Phần của cơ sở")}
        className="mt-6 flex gap-1 overflow-x-auto border-b border-line"
      >
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          return (
            <Link
              key={key}
              href={`/cho-nghi/${property.id}?tab=${key}`}
              aria-current={active ? "page" : undefined}
              className={`-mb-px shrink-0 border-b-2 px-3.5 py-2.5 text-[14px] font-medium transition-colors ${
                active
                  ? "border-ink-900 text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              {t(label)}
            </Link>
          );
        })}
      </nav>

      {tab === "thong-tin" ? (
        <div className="mt-8">
          <InfoForm action={updateProperty} locale={locale} property={property} />
        </div>
      ) : null}

      {tab === "anh" ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            {t("Ảnh cơ sở")}
          </h2>
          {/* Nói thẳng là chưa có, thay vì bày một nút bấm không làm gì. Ảnh
              cần một chỗ để cất tệp — đĩa của máy chủ hay một kho như R2 —
              và đó là quyết định phải chốt trước khi viết dòng đầu tiên. */}
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            {t("Phần này chưa làm. Ảnh cần một nơi lưu trữ được chọn trước — trên máy chủ hoặc một kho ảnh riêng — nên nó đi sau khi có máy chủ.")}
          </p>
        </section>
      ) : null}

      {tab === "thanh-toan" ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            {t("Thanh toán")}
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            {t("Cổng thanh toán đang đặt ở cấp tổ chức: kết nối một lần, mọi cơ sở dùng chung. Mở phần Cài đặt để kết nối hoặc đổi.")}
          </p>
          <Link
            href="/cai-dat"
            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-ink-900 hover:border-ink-900"
          >
            {t("Mở cài đặt thanh toán")}
          </Link>
        </section>
      ) : null}

      {tab === "ota" ? (
        <section className="mt-8 rounded-2xl border border-line bg-surface p-6">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            {t("Đồng bộ kênh")}
          </h2>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            {t("Kênh nối theo từng phòng, nên danh sách nằm chung một chỗ cho mọi cơ sở. Mở trang Kênh để nối Airbnb, Booking.com và các kênh khác.")}
          </p>
          <Link
            href="/kenh"
            className="mt-4 inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 text-[14px] font-semibold text-ink-900 hover:border-ink-900"
          >
            {t("Mở trang Kênh")}
          </Link>
        </section>
      ) : null}

      {tab === "phong" ? (
        <RoomsTab
          rooms={property.rooms}
          propertyId={property.id}
          locale={locale}
          currency={currencySymbol(property.currency)}
          createAction={createRoom}
          updateAction={updateRoom}
          deleteAction={deleteRoom}
        />
      ) : null}

      {tab === "thong-tin" ? (
      <>
      {/* ---- the public page -------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">
          {t("Trang đặt phòng của khách")}
        </h2>
        <p className="mb-6 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
          {t("Một trang công khai để khách tự chọn ngày và đặt. Đặt phòng từ đây vào thẳng lịch này, khoá đêm trên mọi kênh, và không mất đồng hoa hồng nào.")}
        </p>

        {unpriced > 0 ? (
          <p className="mb-5 max-w-2xl rounded-xl border border-warning/25 bg-warning-soft px-4 py-3 text-[13.5px] leading-relaxed text-warning">
            {fill(
              t(
                t("{n} phòng chưa có giá. Khách vẫn đặt được, nhưng sẽ không thấy giá nào cả — nên đặt giá trước khi chia sẻ link."),
              ),
              { n: unpriced },
            )}
          </p>
        ) : null}

        <PublicPageForm
          action={publishProperty}
          propertyId={property.id}
          origin={origin}
          slug={property.publicSlug}
          published={property.published}
          intro={property.intro}
          suggestion={property.name}
        />

        {property.published && property.publicSlug ? (
          <p className="mt-5">
            <a
              href={`/dat/${property.publicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-[14px] font-semibold text-ink-900 underline underline-offset-4"
            >
              {t("Mở trang khách thấy →")}
            </a>
          </p>
        ) : null}
      </section>

      {/* ---- feeds ------------------------------------------------------- */}
      <p className="mt-12 border-t border-line pt-6 text-[13px] text-ink-500">
        {t("Link xuất lịch cho từng phòng nằm ở")}{" "}
        <Link href="/kenh" className="font-medium text-ink-700 underline underline-offset-2">
          {t("Kênh bán")}
        </Link>
        .{" "}
        {property.rooms.some((r) => r.basePrice !== null)
          ? fill(t("Giá thấp nhất đang đặt: {gia}."), {
              gia: formatMoney(
                Math.min(
                  ...property.rooms
                    .filter((r) => r.basePrice !== null)
                    .map((r) => r.basePrice as number),
                ),
                property.currency,
              ),
            })
          : ""}
      </p>

      {/* ---- deleting ---------------------------------------------------- */}
      <section className="mt-12 rounded-2xl border border-danger/25 bg-danger-soft/40 p-6">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">
          {t("Xóa cơ sở")}
        </h2>
        <p className="mb-4 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
          {t("Cơ sở, các phòng bên trong và toàn bộ lượt đặt của chúng sẽ mất. Không có thùng rác và không khôi phục được.")}
        </p>
        <DeletePropertyForm
          action={deleteProperty}
          propertyId={property.id}
          name={property.name}
          rooms={property.rooms.length}
          bookings={bookings}
          upcoming={upcoming}
        />
      </section>
      </>
      ) : null}
    </>
  );
}
