import type { Metadata } from "next";
import Link from "next/link";

import { getT } from "@/lib/locale";

import { requestPasswordReset } from "../actions";
import { ResetRequestForm } from "./ResetRequestForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Quên mật khẩu"), robots: { index: false, follow: false } };
}

/**
 * Asking for a way back in.
 *
 * The page answers the same way whether or not the address has an account —
 * see requestPasswordReset. That is why there is no success screen to
 * navigate to: the confirmation appears in place, and it is deliberately
 * about what was done rather than about what was found.
 */
export default async function ForgotPasswordPage() {
  const t = await getT();

  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
        {t("Khôi phục")}
      </p>
      <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight text-ink-900">
        {t("Quên mật khẩu")}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
        {t("Nhập email của bạn. Chúng tôi gửi một liên kết đặt lại, dùng được một lần và hết hạn sau một giờ.")}
      </p>

      <div className="mt-7">
        <ResetRequestForm action={requestPasswordReset} />
      </div>

      <p className="mt-6 text-center text-[13.5px] text-ink-600">
        <Link
          href="/dang-nhap"
          className="font-medium text-ink-900 underline underline-offset-4"
        >
          {t("Quay lại đăng nhập")}
        </Link>
      </p>
    </>
  );
}
