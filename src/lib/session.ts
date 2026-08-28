import "server-only";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { hashToken, newToken } from "@/lib/tokens";

/**
 * Sessions, owned rather than delegated.
 *
 * Auth.js was tried first and removed: its credentials path in @auth/core
 * always issues a JWT cookie and never writes to the adapter's session table,
 * whatever strategy is configured. A JWT cannot be revoked, and revocation is
 * the whole requirement here — when an owner removes a collaborator, that
 * person must lose the calendar on their next request. A row you can DELETE
 * does exactly that.
 *
 * What is left is small enough to read in one sitting, which is its own
 * argument: this is the code that decides who gets in.
 */

const COOKIE = "tlshost_session";
const MAX_AGE_DAYS = 30;

/** Issues a session and sets the cookie. Returns nothing on purpose. */
export async function createSession(userId: string): Promise<void> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + MAX_AGE_DAYS * 86_400_000);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true, // JavaScript cannot read it, so an XSS cannot steal it
    sameSite: "lax", // survives a normal top-level navigation, blocks CSRF POSTs
    secure: process.env.NODE_ENV === "production", // http://localhost must still work
    path: "/",
    expires: expiresAt,
  });
}

/**
 * The current session's user id, or null.
 *
 * Not wrapped in React's `cache()` here: this reads cookies and hits the
 * database, and the caching belongs one level up in the DAL where the whole
 * membership lookup can be memoised together. See src/lib/dal.ts.
 */
export async function readSession(): Promise<{ userId: string } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!session) return null;

  // Expiry is checked here rather than trusted from the cookie, because the
  // cookie's own expiry is a client-side hint the client controls.
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return { userId: session.userId };
}

/** Ends the current session everywhere, not just in this browser. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;

  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }

  jar.delete(COOKIE);
}

/**
 * Constant-time string comparison, for the places a wrong answer must not be
 * distinguishable by how long it took.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
