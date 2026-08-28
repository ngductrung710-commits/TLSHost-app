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
 * Runs `fn` in a transaction that has set one Postgres session variable.
 *
 * Everything below is a wrapper on this, and together they name a pattern the
 * codebase arrived at the hard way: every entry point that identifies itself
 * with something other than a session needs a narrow policy arm keyed on
 * whatever it does present, because the ordinary policies are written around an
 * organization that nothing has established yet.
 *
 * There are four, and each is one table, SELECT only, matched on a value the
 * caller must already hold:
 *
 *   sign-in            reads `membership` to find the org   app.current_user_id
 *   invitations        read `membership` before joining     app.invite_token_hash
 *   availability feeds read `room` with no account          app.ical_token
 *   the booking page   reads `property` and `room`          app.public_slug
 *
 * Two things learned from getting these wrong. A narrow arm on the table you
 * query is not enough — every table the query traverses is filtered
 * independently, and a filtered-out join comes back as null rather than as an
 * error. And two arms that join to each other's tables deadlock the planner:
 * Postgres refuses the pair with 42P17.
 *
 * Each of these buys only enough to learn the organization. Everything after
 * that goes through withOrg, like the rest of the app.
 */
function withSetting<T>(
  name: string,
  value: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // The name is a literal from the call sites below, never user input; the
    // value is parameterised.
    await tx.$executeRawUnsafe(
      `SELECT set_config('${name}', $1, true)`,
      value,
    );
    return fn(tx);
  });
}

/**
 * Scoped to one user, for the membership lookup that works out which org a
 * session belongs to. That query cannot use withOrg — finding the org is its
 * whole job — and `membership` is under row-level security, so without some
 * identity set it reads back nothing. That was a real bug: sign-up wrote every
 * row correctly and then bounced the person back to the sign-in page.
 */
export function withUser<T>(
  userId: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return withSetting("app.current_user_id", userId, fn);
}

/**
 * Scoped to one invitation. Accepting one happens before the person has a
 * session, so neither withOrg nor withUser applies.
 *
 * Takes the hash, never the token, so this file never handles a value that
 * could be replayed as a credential.
 */
export function withInviteToken<T>(
  tokenHash: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return withSetting("app.invite_token_hash", tokenHash, fn);
}

/** Scoped to one room's public availability feed. Carries no account at all. */
export function withFeedToken<T>(
  token: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return withSetting("app.ical_token", token, fn);
}

/**
 * Scoped to one published property's guest booking page.
 *
 * The slug is not a secret — it is meant to be shared. What guards the page is
 * the `published` flag, which both policy arms test, so an unpublished
 * property cannot be reached through a guessed URL.
 */
export function withPublicSlug<T>(
  slug: string,
  fn: (tx: OrgClient) => Promise<T>,
): Promise<T> {
  return withSetting("app.public_slug", slug, fn);
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
