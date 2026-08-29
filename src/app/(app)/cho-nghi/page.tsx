import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { requireMember, visiblePropertyFilter } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { getT } from "@/lib/locale";
import { fill } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Chỗ nghỉ") };
}

export default async function PropertiesPage() {
  const t = await getT();
  const member = await requireMember();
  if (member.role === "HOUSEKEEPER") redirect("/buong-phong");

  const properties = await withOrg(member.orgId, (tx) =>
    tx.property.findMany({
      where: visiblePropertyFilter(member),
      select: {
        id: true,
        name: true,
        address: true,
        published: true,
        publicSlug: true,
        rooms: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
  );

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">
            {t("Chỗ nghỉ")}
          </h1>
          <p className="mt-1 text-[14px] text-ink-600">
            {fill(t("{choNghi} chỗ nghỉ · {phong} phòng"), {
              choNghi: properties.length,
              phong: properties.reduce((n, p) => n + p.rooms.length, 0),
            })}
          </p>
        </div>

        {member.role === "OWNER" ? (
          <Link
            href="/cho-nghi/moi"
            className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 hover:bg-ink-800"
          >
            {t("Thêm chỗ nghỉ")}
          </Link>
        ) : null}
      </div>

      {properties.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="text-[15px] font-semibold text-ink-900">
            {t("Chưa có chỗ nghỉ nào")}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-600">
            {t("Thêm chỗ nghỉ đầu tiên và liệt kê các phòng bên trong. Lịch sẽ dựng lên từ đó.")}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <li
              key={property.id}
              className="rounded-2xl border border-line bg-surface p-5"
            >
              <h2 className="text-[16px] font-semibold text-ink-900">
                {member.role === "OWNER" ? (
                  <Link
                    href={`/cho-nghi/${property.id}`}
                    className="hover:underline"
                  >
                    {property.name}
                  </Link>
                ) : (
                  property.name
                )}
              </h2>
              {property.address ? (
                <p className="mt-0.5 text-[13px] text-ink-500">{property.address}</p>
              ) : null}
              {property.published && property.publicSlug ? (
                <p className="mt-2 inline-flex rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-positive">
                  {t("Trang khách đang mở")}
                </p>
              ) : null}

              <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
                {property.rooms.map((room) => (
                  <li key={room.id} className="text-[14px] text-ink-700">
                    {room.name}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
