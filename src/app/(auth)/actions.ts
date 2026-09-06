"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "@/lib/passwordRules";
import { burnTimeOnMiss, hashPassword, verifyPassword } from "@/lib/passwords";
import { fill } from "@/lib/i18n";
import { clear, clientIp, hit } from "@/lib/rateLimit";
import { sendMail } from "@/lib/mail";
import { origin } from "@/lib/origin";
import { createSession, destroySession } from "@/lib/session";
import { hashToken, newToken } from "@/lib/tokens";
import { getT } from "@/lib/locale";

export type AuthState = {
  error: string | null;
  /**
   * A neutral confirmation, for forms whose success is not a redirect.
   *
   * Password reset needs one: it answers the same way for an address that
   * exists and one that does not, so there is nothing to redirect to and the
   * page has to say something.
   */
  notice?: string | null;
};

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

/**
 * One message for every way a sign-in can fail.
 *
 * Saying "no account with that email" is friendlier and tells anyone who asks
 * which of your customers' addresses are registered. Paired with
 * burnTimeOnMiss(), a wrong email and a wrong password are indistinguishable
 * in both content and timing.
 */
const SIGN_IN_FAILED = "Email hoặc mật khẩu không đúng.";

/**
 * How many wrong guesses before waiting.
 *
 * Two limits, because they stop different things. The per-email one protects
 * one host whose address somebody knows; the per-address one stops a script
 * working through a list of emails from one machine, which the first limit
 * would never notice.
 *
 * The address limit is the looser of the two on purpose: an office, a café or
 * a phone network puts many legitimate people behind one address, and locking
 * them out together to slow down an attacker is a bad trade at these volumes.
 */
const PER_EMAIL = { limit: 5, windowSeconds: 15 * 60 };
const PER_IP = { limit: 30, windowSeconds: 15 * 60 };

/**
 * Counted for addresses that have no account, too.
 *
 * Skipping the count when the email is unknown would make "locked out" mean
 * "this address is registered" — undoing, in one word, the thing
 * SIGN_IN_FAILED and burnTimeOnMiss() exist to hide.
 */
function tooManyMessage(seconds: number): string {
  // fill() on a key, not a template literal. A template literal builds the
  // sentence before anything can translate it — t() then looks up a string
  // with the number already inside and finds nothing, so an English workspace
  // gets a Vietnamese sentence. check:i18n cannot see it either: it reads
  // quoted literals, and a backtick is not a quote.
  //
  // This is the same mistake LIMIT_MESSAGES.properties had, fixed one day
  // earlier in this same codebase. It is an easy one to make twice.
  return fill("Sai quá nhiều lần. Thử lại sau {n} phút.", {
    n: Math.ceil(seconds / 60),
  });
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    // Still pay the hash cost: a malformed email must not be faster to reject
    // than a well-formed one that simply has no account.
    await burnTimeOnMiss(String(formData.get("password") ?? ""));
    return { error: SIGN_IN_FAILED };
  }

  const { email, password } = parsed.data;

  // Checked before the password is verified, so a locked-out attacker cannot
  // keep spending our CPU on argon2 hashes — the rate limit is also what stops
  // the sign-in form being an amplifier for someone else's load.
  const ip = await clientIp();
  const emailKey = `signin:email:${email}`;
  const ipKey = ip === null ? null : `signin:ip:${ip}`;

  const byEmail = hit(emailKey, PER_EMAIL.limit, PER_EMAIL.windowSeconds);
  if (!byEmail.allowed) {
    await burnTimeOnMiss(password);
    return { error: tooManyMessage(byEmail.retryAfterSeconds) };
  }
  if (ipKey !== null) {
    const byIp = hit(ipKey, PER_IP.limit, PER_IP.windowSeconds);
    if (!byIp.allowed) {
      await burnTimeOnMiss(password);
      return { error: tooManyMessage(byIp.retryAfterSeconds) };
    }
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    await burnTimeOnMiss(password);
    return { error: SIGN_IN_FAILED };
  }

  if (!(await verifyPassword(user.passwordHash, password))) {
    return { error: SIGN_IN_FAILED };
  }

  // One good sign-in clears the count. Somebody who mistypes four times and
  // then gets it right should not be one slip away from a lockout for the rest
  // of the window.
  clear(emailKey);
  if (ipKey !== null) clear(ipKey);

  await createSession(user.id);
  redirect("/lich");
}

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Cho tôi biết tên bạn."),
  orgName: z.string().trim().min(1, "Đặt tên cho cơ sở của bạn."),
  email: z.string().trim().toLowerCase().email("Email chưa đúng định dạng."),
  password: z.string(),
});

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getT();
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    orgName: formData.get("orgName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("Thông tin chưa hợp lệ.") };
  }

  const { name, orgName, email, password } = parsed.data;

  const weak = passwordProblem(password, { email, name });
  if (weak) return { error: fill(t(weak), { n: MIN_PASSWORD_LENGTH }) };

  const passwordHash = await hashPassword(password);

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, name, passwordHash },
        select: { id: true },
      });

      const org = await tx.organization.create({
        data: { name: orgName },
        select: { id: true },
      });

      // The membership table is under row-level security, so the insert below
      // is invisible to Postgres unless the transaction says which org it is
      // acting for. This is the one place that identity is established rather
      // than looked up, so it happens here instead of through withOrg().
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org.id}, true)`;

      await tx.membership.create({
        data: {
          orgId: org.id,
          userId: user.id,
          role: "OWNER",
          canEditOthersBookings: true,
          joinedAt: new Date(),
        },
      });

      return user.id;
    });
  } catch (error) {
    // P2002 is Prisma's unique-constraint code; here it can only be the email.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { error: t("Email này đã có tài khoản.") };
    }
    throw error;
  }

  await createSession(userId);
  redirect("/lich");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/dang-nhap");
}

/* -------------------------------------------------------------------------- */
/* Khôi phục mật khẩu                                                         */
/* -------------------------------------------------------------------------- */

/**
 * How long a reset link lives.
 *
 * Short, because the link is a way into the account and it sits in an inbox
 * that may not be as well protected as the account itself. Long enough that
 * someone who requests it, gets distracted, and comes back after lunch still
 * finds it working — an expiry that fires while people are living their lives
 * teaches them to request four links, which is worse.
 */
const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * The same answer whether or not the address is registered.
 *
 * A form that says "no account with that email" is a way to ask, one address
 * at a time, which of somebody's customers use this product. The message
 * below is returned for a hit, a miss, a rate limit and a failed send alike.
 */
const RESET_SENT =
  "Nếu địa chỉ này có tài khoản, chúng tôi vừa gửi một liên kết đặt lại mật khẩu. Kiểm tra cả hộp thư rác.";

/**
 * How many requests before waiting.
 *
 * Lower than sign-in, because each one costs an outbound email rather than a
 * hash — an unlimited form here is a way to use this product to post mail to
 * a stranger, repeatedly, from our domain.
 */
const RESET_PER_EMAIL = { limit: 3, windowSeconds: 15 * 60 };
const RESET_PER_IP = { limit: 10, windowSeconds: 15 * 60 };

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email chưa đúng định dạng."),
});

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getT();
  const parsed = requestSchema.safeParse(Object.fromEntries(formData));

  // A malformed address is the one thing worth saying out loud: it cannot
  // belong to anybody, so saying so leaks nothing and saves a wasted wait.
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("Thông tin chưa hợp lệ.") };
  }

  const { email } = parsed.data;

  const ip = await clientIp();
  const overEmail = !hit(
    `reset:email:${email}`,
    RESET_PER_EMAIL.limit,
    RESET_PER_EMAIL.windowSeconds,
  ).allowed;
  const overIp =
    ip !== null &&
    !hit(`reset:ip:${ip}`, RESET_PER_IP.limit, RESET_PER_IP.windowSeconds).allowed;

  // Rate limited answers exactly like success. Telling somebody they are
  // limited on this address confirms the address is worth limiting.
  if (overEmail || overIp) return { error: null, notice: t(RESET_SENT) };

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, passwordHash: true },
  });

  // Only accounts that have a password can reset one. An account created
  // through an invitation and never finished has nothing to put back.
  if (user?.passwordHash) {
    const token = newToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashToken(token),
        passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });

    const base = await origin();
    const link = `${base}/dat-lai-mat-khau/${token}`;

    // The result is deliberately dropped. What a failed send means to this
    // form is nothing — the answer is the same sentence either way, and the
    // provider's error is already in the server log where it belongs.
    await sendMail({
      to: email,
      subject: t("Đặt lại mật khẩu TLSHost"),
      text: [
        fill(t("Chào {ten},"), { ten: user.name }),
        "",
        t("Có người vừa yêu cầu đặt lại mật khẩu cho tài khoản này. Mở liên kết dưới đây để đặt mật khẩu mới:"),
        "",
        link,
        "",
        t("Liên kết dùng được một lần và hết hạn sau một giờ."),
        t("Nếu không phải bạn yêu cầu, bỏ qua thư này — mật khẩu hiện tại vẫn nguyên."),
      ].join("\n"),
    });
  }

  return { error: null, notice: t(RESET_SENT) };
}

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string(),
});

export async function resetPassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const t = await getT();
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: t("Liên kết không hợp lệ.") };

  const { token, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { passwordResetTokenHash: hashToken(token) },
    select: { id: true, email: true, name: true, passwordResetExpiresAt: true },
  });

  // Expiry checked here and not only when the page was drawn: the page was
  // rendered on an earlier request, and an hour is long enough for the link to
  // go stale while the form sits open.
  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt <= new Date()) {
    return {
      error: t("Liên kết này đã hết hạn hoặc đã được dùng. Yêu cầu một liên kết mới."),
    };
  }

  // Sau khi tra người dùng, không phải trước. Luật mật khẩu cần email và tên
  // để từ chối những mật khẩu chính là tên chủ tài khoản, mà ở đầu hàm này
  // chỉ có một token trong tay. Đổi lại, một liên kết đã hết hạn kèm mật khẩu
  // yếu sẽ được trả lời là hết hạn — đúng thứ tự, vì mật khẩu mạnh cũng không
  // cứu được một liên kết chết.
  const problem = passwordProblem(password, user);
  if (problem) return { error: fill(t(problem), { n: MIN_PASSWORD_LENGTH }) };

  const passwordHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        // Cleared, which is what makes the link single-use. Somebody who reads
        // the mailbox later finds a link that no longer opens anything.
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    }),
    // Every existing session goes. Resetting a password is what somebody does
    // when they think another person has been in the account, and leaving that
    // person signed in on their own machine defeats the whole exercise.
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  await createSession(user.id);
  redirect("/lich");
}
