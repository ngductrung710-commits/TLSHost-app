"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { withInviteToken } from "@/lib/db";
import { fill } from "@/lib/i18n";
import { getT } from "@/lib/locale";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/passwordRules";
import { hashPassword } from "@/lib/passwords";
import { createSession } from "@/lib/session";
import { hashToken } from "@/lib/tokens";

export type AcceptState = { error: string | null };

const schema = z.object({
  token: z.string().min(1),
  password: z.string(),
});

const UNUSABLE = "Lời mời này không dùng được nữa. Nhờ chủ nhà tạo lại giúp bạn.";

export async function acceptInvite(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: UNUSABLE };

  const t = await getT();
  const weak = passwordProblem(parsed.data.password);
  if (weak) return { error: fill(t(weak), { n: MIN_PASSWORD_LENGTH }) };

  const tokenHash = hashToken(parsed.data.token);
  const passwordHash = await hashPassword(parsed.data.password);

  let userId: string | null = null;

  await withInviteToken(tokenHash, async (tx) => {
    const invite = await tx.membership.findFirst({
      where: { inviteTokenHash: tokenHash },
      select: {
        id: true,
        orgId: true,
        userId: true,
        joinedAt: true,
        inviteExpiresAt: true,
      },
    });

    // Re-checked here rather than trusted from the page that rendered the form.
    // The page ran on a previous request; the invitation could have been used
    // or revoked since, and this is the request that grants access.
    if (!invite) return;
    if (invite.joinedAt !== null) return;
    if (invite.inviteExpiresAt === null || invite.inviteExpiresAt <= new Date()) {
      return;
    }

    // The token gets us as far as reading the row; writing it goes through the
    // ordinary org policy, so the transaction has to say which org it is acting
    // for. That org id came from the row itself — from a record the caller
    // proved they hold a token for — never from anything they sent.
    //
    // An earlier attempt used a FOR UPDATE policy with WITH CHECK (true) and
    // skipped this. It does not work: Postgres still required the org policy's
    // check on the new row, and clearing the token failed with 42501 while
    // keeping it succeeded. See the drop_accept_policy migration.
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${invite.orgId}, true)`;

    await tx.membership.update({
      where: { id: invite.id },
      data: {
        joinedAt: new Date(),
        // Cleared, so the link cannot be replayed to reset the password of an
        // account that now belongs to someone.
        inviteTokenHash: null,
        inviteExpiresAt: null,
      },
    });

    // The user row was created unusable at invite time — no passwordHash means
    // no way to sign in. This is the moment it becomes an account.
    await tx.user.update({
      where: { id: invite.userId },
      data: { passwordHash },
    });

    userId = invite.userId;
  });

  if (!userId) return { error: UNUSABLE };

  await createSession(userId);
  redirect("/lich");
}
