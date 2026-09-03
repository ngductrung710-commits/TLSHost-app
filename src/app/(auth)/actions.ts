"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  burnTimeOnMiss,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from "@/lib/passwords";
import { fill } from "@/lib/i18n";
import { clear, clientIp, hit } from "@/lib/rateLimit";
import { createSession, destroySession } from "@/lib/session";
import { getT } from "@/lib/locale";

export type AuthState = { error: string | null };

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

  const weak = passwordProblem(password);
  if (weak) return { error: weak };

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
