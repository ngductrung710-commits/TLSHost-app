import type { Metadata } from "next";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { getT } from "@/lib/locale";
import { hashToken } from "@/lib/tokens";

import { resetPassword } from "../../actions";
import { ResetForm } from "./ResetForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Đặt mật khẩu mới"), robots: { index: false, follow: false } };
}

/**
 * Setting a new password from a mailed link.
 *
 * The token is checked here so a dead link says so before somebody types a
 * password into a form that cannot accept it — and checked again in the
 * action, because this page was drawn on an earlier request and an hour is
 * long enough for a link to expire while the form sits open.
 *
 * The token stays in the path and never in a rendered field beyond the hidden
 * input that submits it. It is a bearer credential for the length of its life:
 * anything that logs it, or puts it in a query string a referrer header might
 * carry, hands over the account.
 */
export default async function ResetPasswordPage(
  props: PageProps<"/dat-lai-mat-khau/[token]">,
) {
  const t = await getT();
  const { token } = await props.params;

  const user = await prisma.user.findUnique({
    where: { passwordResetTokenHash: hashToken(token) },
    select: { email: true, passwordResetExpiresAt: true },
  });

  const usable =
    user !== null &&
    user.passwordResetExpiresAt !== null &&
    user.passwordResetExpiresAt > new Date();

  if (!usable) {
    return (
      <>
        <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
          {t("Liên kết không dùng được")}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
          {t("Liên kết này đã hết hạn hoặc đã được dùng. Yêu cầu một liên kết mới.")}
        </p>
        <p className="mt-6">
          <Link
            href="/quen-mat-khau"
            className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800"
          >
            {t("Gửi liên kết mới")}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-500">
        {t("Khôi phục")}
      </p>
      <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight text-ink-900">
        {t("Đặt mật khẩu mới")}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
        {/* The address is shown because a host with two accounts needs to know
            which one this link opens. It is not a leak: whoever holds the link
            already has the mailbox it was sent to. */}
        {user.email}
      </p>

      <div className="mt-7">
        <ResetForm action={resetPassword} token={token} />
      </div>
    </>
  );
}
