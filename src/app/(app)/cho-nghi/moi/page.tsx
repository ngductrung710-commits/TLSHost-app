import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireMember } from "@/lib/dal";

import { PropertyForm } from "./PropertyForm";
import { createProperty } from "../actions";

export const metadata: Metadata = { title: "Thêm chỗ nghỉ" };

export default async function NewPropertyPage() {
  const member = await requireMember();
  if (member.role !== "OWNER") redirect("/cho-nghi");

  return (
    <>
      <Link
        href="/cho-nghi"
        className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
      >
        ← Về danh sách
      </Link>
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight text-ink-900">
        Thêm chỗ nghỉ
      </h1>
      <p className="mb-7 mt-1 text-[14px] text-ink-600">
        Phòng là thứ nhận đặt. Liệt kê đủ phòng ở đây thì lịch sẽ có đủ hàng.
      </p>

      <PropertyForm action={createProperty} />
    </>
  );
}
