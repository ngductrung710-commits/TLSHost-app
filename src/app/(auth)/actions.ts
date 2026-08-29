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
