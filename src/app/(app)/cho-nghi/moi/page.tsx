import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireMember } from "@/lib/dal";

import { PropertyForm } from "./PropertyForm";
import { createProperty } from "../actions";
import { getT } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Thêm chỗ nghỉ") };
}

export default async function NewPropertyPage() {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") redirect("/cho-nghi");

  return (
    <>
      <Link
        href="/cho-nghi"
        className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
      >
        {t("← Về danh sách")}
      </Link>
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight text-ink-900">
        {t("Thêm chỗ nghỉ")}
      </h1>
      <p className="mb-7 mt-1 text-[14px] text-ink-600">
        {t("Phòng là thứ nhận đặt. Liệt kê đủ phòng ở đây thì lịch sẽ có đủ hàng.")}
      </p>

      <PropertyForm action={createProperty} />
    </>
  );
}
