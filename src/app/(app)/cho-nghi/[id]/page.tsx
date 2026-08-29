import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { formatVnd } from "@/lib/dates";

import { PublicPageForm } from "./PublicPageForm";
import { publishProperty, setRoomPrice } from "./actions";
import { getT } from "@/lib/locale";
import { fill } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Chỗ nghỉ") };
}

export default async function PropertyPage(props: PageProps<"/cho-nghi/[id]">) {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") redirect("/cho-nghi");

  const { id } = await props.params;

  const property = await withOrg(member.orgId, (tx) =>
    tx.property.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        address: true,
        intro: true,
        publicSlug: true,
        published: true,
        rooms: {
          select: { id: true, name: true, capacity: true, basePrice: true },
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

      {/* ---- rooms and prices ------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">
          {t("Phòng và giá")}
        </h2>
        <p className="mb-4 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
          {t("Giá mỗi đêm hiển thị trên trang đặt phòng. Phòng chưa có giá vẫn nhận được đặt, chỉ là khách không thấy con số nào.")}
        </p>

        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {property.rooms.map((room) => (
            <li
              key={room.id}
              className="flex flex-wrap items-center gap-4 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink-900">
                  {room.name}
                </p>
                <p className="text-[12.5px] text-ink-500">
                  {t("Tối đa")} <span className="tnum">{room.capacity}</span> {t("khách")}
                </p>
              </div>

              <form action={setRoomPrice} className="flex items-end gap-2">
                <input type="hidden" name="roomId" value={room.id} />
                <div>
                  <label
                    htmlFor={`price-${room.id}`}
                    className="block text-[12px] font-medium text-ink-600"
                  >
                    {t("Giá mỗi đêm (₫)")}
                  </label>
                  <input
                    id={`price-${room.id}`}
                    name="basePrice"
                    type="number"
                    min={0}
                    step={10000}
                    defaultValue={room.basePrice ?? ""}
                    className="mt-1 min-h-11 w-40 rounded-xl border border-line-strong bg-white px-3 text-[15px] tnum"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-11 rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-50"
                >
                  {t("Lưu")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

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
              gia: formatVnd(
                Math.min(
                  ...property.rooms
                    .filter((r) => r.basePrice !== null)
                    .map((r) => r.basePrice as number),
                ),
              ),
            })
          : ""}
      </p>
    </>
  );
}
