import type { Metadata } from "next";
import Link from "next/link";

import { withInviteToken } from "@/lib/db";
import { hashToken } from "@/lib/tokens";

import { AcceptForm } from "./AcceptForm";
import { acceptInvite } from "./actions";
import { getT } from "@/lib/locale";
import { fill } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Tham gia đội") };
}

export default async function AcceptInvitePage(
  props: PageProps<"/tham-gia/[token]">,
) {
  const t = await getT();
  const { token } = await props.params;
  const tokenHash = hashToken(token);

  // Scoped to the invitation itself: no session exists yet, and neither the
  // org nor the user is known until this row is found. The policy admits
  // exactly the row whose token hash matches.
  const invite = await withInviteToken(tokenHash, (tx) =>
    tx.membership.findFirst({
      where: { inviteTokenHash: tokenHash },
      select: {
        id: true,
        role: true,
        joinedAt: true,
        inviteExpiresAt: true,
        org: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    }),
  );

  // One message for every failure. A wrong, used or expired token should not
  // be distinguishable — otherwise a link becomes a way to probe which
  // invitations exist.
  const usable =
    invite !== null &&
    invite.joinedAt === null &&
    invite.inviteExpiresAt !== null &&
    invite.inviteExpiresAt > new Date();

  if (!usable) {
    return (
      <>
        <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
          {t("Lời mời không dùng được")}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
          {t("Link này đã được dùng, đã hết hạn, hoặc không đúng. Nhờ chủ nhà tạo lại một lời mời mới giúp bạn.")}
        </p>
        <p className="mt-6">
          <Link
            href="/dang-nhap"
            className="text-[15px] font-semibold text-ink-900 underline underline-offset-4"
          >
            {t("Về trang đăng nhập")}
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
        {t("Lời mời")}
      </p>
      <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight text-ink-900">
        Tham gia {invite.org.name}
      </h1>
      <p className="mb-7 mt-2 text-[15px] leading-relaxed text-ink-600">
        {fill(t("Chào {ten}. Đặt mật khẩu để bắt đầu — tài khoản của bạn là"), {
          ten: invite.user.name,
        })}{" "}
        <span className="font-medium text-ink-900">{invite.user.email}</span>.
      </p>

      <AcceptForm action={acceptInvite} token={token} />
    </>
  );
}
