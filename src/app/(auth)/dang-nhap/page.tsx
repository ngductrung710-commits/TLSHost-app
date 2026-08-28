import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getActiveMember } from "@/lib/dal";
import { AuthForm } from "../AuthForm";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Đăng nhập" };

export default async function SignInPage() {
  // Someone already signed in has no business on this page; send them to work.
  if (await getActiveMember()) redirect("/lich");

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
        Không gian chủ nhà
      </p>
      <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight text-ink-900">
        Chào mừng trở lại
      </h1>
      <p className="mt-2 mb-7 text-[15px] text-ink-600">
        Đăng nhập vào không gian quản lý của bạn.
      </p>

      <AuthForm mode="signIn" action={signIn} />
    </>
  );
}
