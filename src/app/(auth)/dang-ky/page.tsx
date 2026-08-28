import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getActiveMember } from "@/lib/dal";
import { AuthForm } from "../AuthForm";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Tạo tài khoản" };

export default async function SignUpPage() {
  if (await getActiveMember()) redirect("/lich");

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
        Không gian chủ nhà
      </p>
      <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight text-ink-900">
        Tạo tài khoản chủ nhà
      </h1>
      <p className="mt-2 mb-7 text-[15px] text-ink-600">
        Một tài khoản, một cơ sở. Thêm chỗ nghỉ và mời người sau.
      </p>

      <AuthForm mode="signUp" action={signUp} />
    </>
  );
}
