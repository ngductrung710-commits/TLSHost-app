import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * The database connection, and the only supported way to read tenant data.
 *
 * Two things live here that the rest of the app depends on and should never
 * have to think about again:
 *
 *   - `prisma` connects as a non-owner role, so the row-level security
 *     policies from the guarantees migration actually apply. Connecting as the
 *     owner would leave them silently inactive.
 *
 *   - `withOrg()` opens a transaction, tells Postgres which organization is
 *     asking, and runs your queries inside it. Outside such a transaction the
 *     policies return zero rows, so forgetting this fails closed — an empty
 *     page, never another customer's data.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Thrown at import time on purpose. A server that starts without a database
  // URL only fails later, one request at a time, in whatever shape the first
  // query happens to take.
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });

// Next's dev server re-evaluates modules on every edit. Without this, each
// reload opens another pool and Postgres runs out of connections after a few
// minutes of work.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Anything you can do inside an org-scoped transaction.
 *
 * Prisma's own type rather than a hand-written Omit of PrismaClient: the two
 * are not interchangeable, and helpers like assertNightsFree() take the real
 * one. Spelling it out separately only produced a type that looked right and
 * would not pass.
 */
type OrgClient = Prisma.TransactionClient;

/**
 * Runs `fn` in a transaction that Postgres will only answer for this org.
 *
 * `set_config(..., true)` is the transaction-local form. That detail is what
 * makes this safe behind a connection pool: the setting is discarded when the
 * transaction ends, so the next request to borrow the same physical connection
 * cannot inherit the previous request's organization. The non-local form would
 * be a cross-tenant leak that only appears under load.
 *
 * Everything the callback touches is filtered by the policies. That includes
 * queries this file has never seen — a hand-written raw query, a future
 * generated one — which is the reason the check lives in the database.
 */
export async function withOrg<T>(
  orgId: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return fn(tx);
  });
}

/**
 * Runs `fn` in a transaction scoped to a *user* rather than an organization.
 *
 * Exists for exactly one query: the membership lookup that works out which org
 * a session belongs to. That query cannot use withOrg(), because finding the
 * org is its whole job — and `membership` is under row-level security, so
 * without some identity set it reads back nothing. That was a real bug: sign-up
 * wrote a user, an org, a membership and a session, then bounced the person
 * straight back to the sign-in page because the very next read saw zero rows.
 *
 * The policy that makes this work grants SELECT on a membership row whose
 * userId matches — nothing else, and no write. See the membership_lookup
 * migration.
 */
export async function withUser<T>(
  userId: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return fn(tx);
  });
}

/**
 * Runs `fn` in a transaction scoped to one invitation.
 *
 * Accepting an invitation happens before the person has a session, so neither
 * withOrg nor withUser applies: there is no
 * current org (they are not in one yet) and no current user (they are not
 * signed in). The policy admits exactly the row whose invite token hash
 * matches, which is one row, and only to whoever holds the link.
 *
 * The caller passes the hash, never the token — so this file never sees a
 * value that could be replayed as a credential.
 */
export async function withInviteToken<T>(
  tokenHash: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.invite_token_hash', ${tokenHash}, true)`;
    return fn(tx);
  });
}

/**
 * Runs `fn` in a transaction scoped to one room's public feed token.
 *
 * The last of the three narrow scopes, and together they name a pattern worth
 * remembering: every place where identity arrives as something other than a
 * session needs its own arm, because the policies are written around an org
 * that nothing has established yet. Sign-in has withUser, invitations have
 * withInviteToken, and a feed request — which carries no account at all — has
 * this. Each is one table, SELECT only, matched on a value the caller must
 * already hold.
 *
 * Used only to learn which organization the room belongs to. Everything the
 * feed then reads goes through withOrg like the rest of the app.
 */
export async function withFeedToken<T>(
  token: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.ical_token', ${token}, true)`;
    return fn(tx);
  });
}

/**
 * Postgres error codes this app treats as expected outcomes rather than bugs.
 *
 * 23P01 is an exclusion constraint violation — the double-booking guard firing.
 * It arrives as an error, but it means "those nights are taken", which is a
 * sentence to show a host, not a stack trace to log.
 */
export const PG_EXCLUSION_VIOLATION = "23P01";
export const PG_CHECK_VIOLATION = "23514";

/**
 * Reads the Postgres SQLSTATE off an unknown thrown value, or null.
 *
 * Prisma does not surface it at the top level. A constraint violation arrives
 * as PrismaClientKnownRequestError with `code: "P2039"` — a generic "database
 * error" — and the real 23P01 sits three levels down:
 *
 *   error.meta.driverAdapterError.cause.code
 *
 * An earlier version of this checked `error.code` and `error.meta.code`, which
 * meant the exclusion-constraint branch in the booking actions never fired:
 * a genuine double-booking race would have produced a 500 instead of the
 * message written for it. Found by throwing the violation on purpose against
 * the real database and printing the error, which is the only way to learn
 * this — the shape is in no type definition.
 */
export function pgErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;

  const meta = (error as { meta?: unknown }).meta;
  if (typeof meta === "object" && meta !== null) {
    const driver = (meta as { driverAdapterError?: unknown })
      .driverAdapterError;
    if (typeof driver === "object" && driver !== null) {
      const cause = (driver as { cause?: unknown }).cause;
      if (typeof cause === "object" && cause !== null) {
        const code = (cause as { code?: unknown }).code;
        if (typeof code === "string") return code;
      }
    }
  }

  // A raw driver error that never passed through Prisma carries it directly.
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === "string" && /^\d{2}[0-9A-Z]{3}$/.test(direct)) {
    return direct;
  }

  return null;
}
