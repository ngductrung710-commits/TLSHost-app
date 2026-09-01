import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getActiveMember } from "@/lib/dal";
import { AuthForm } from "../AuthForm";
import { signUp } from "../actions";
import { getT } from "@/lib/locale";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Tạo tài khoản") };
}

export default async function SignUpPage() {
  const t = await getT();
  if (await getActiveMember()) redirect("/lich");

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
        {t("Không gian chủ nhà")}
      </p>
      <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight text-ink-900">
        {t("Tạo tài khoản chủ nhà")}
      </h1>
      <p className="mt-2 mb-7 text-[15px] text-ink-600">
        {t("Một tài khoản, một doanh nghiệp. Thêm cơ sở và mời người sau.")}
      </p>

      <AuthForm mode="signUp" action={signUp} />
    </>
  );
}
