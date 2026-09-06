import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { withOrg, withUser } from "@/lib/db";
import { limitsFor } from "@/lib/plans";
import { readSession } from "@/lib/session";

import type { ActiveMember } from "@/lib/member";

/**
 * The data access layer: the one place that answers "who is asking, and for
 * which organization".
 *
 * Every page, action and route handler goes through `requireMember()` before
 * touching tenant data. Doing the check here rather than in a proxy matters:
 * a proxy runs before routing and is easy to route around, while this runs at
 * the point of use and cannot be skipped without the query failing — the
 * org id it returns is the same one `withOrg()` needs.
 *
 * `cache()` memoises for the duration of one render pass, so a layout and the
 * three components inside it share a single pair of queries rather than four.
 */

/**
 * Resolves the signed-in user's membership, or null when there is none.
 *
 * Returns null rather than redirecting so that pages which are legitimately
 * public (sign-in, sign-up) can call it too. `requireMember` is the version
 * with teeth.
 */
export const getActiveMember = cache(async (): Promise<ActiveMember | null> => {
  const session = await readSession();
  if (!session) return null;

  // withUser, not withOrg: this query is what *determines* the org, so it
  // cannot run inside a transaction already scoped to one. `membership` is
  // still under row-level security — the policy simply also admits rows
  // belonging to the user the session names, which is the only identity
  // available at this point. That id came from a session token the server
  // looked up itself, so the client cannot forge it.
  const membership = await withUser(session.userId, async (tx) => {
    const found = await tx.membership.findFirst({
      where: { userId: session.userId, joinedAt: { not: null } },
      orderBy: { invitedAt: "asc" },
      select: {
        id: true,
        orgId: true,
        role: true,
        canEditOthersBookings: true,
        org: {
          select: { name: true, timezone: true, plan: true, planUntil: true },
        },
        user: { select: { name: true, email: true } },
      },
    });
    if (!found) return null;

    // The scopes come second, on purpose.
    //
    // Asking for them in the select above — a to-many alongside the two
    // to-one relations — makes Prisma fan the load out into queries it issues
    // before the parent's client is free, and pg warns that this is deprecated
    // and removed in pg@9. Measured, not guessed: `org` + `user` alone is
    // silent, `scopes` alone is silent, the three together warn, and splitting
    // them like this is silent again.
    //
    // It matters more than a warning usually would because this function runs
    // on every authenticated request. At pg@9 it stops being a warning, and
    // every signed-in page in the product fails at once.
    const scopes = await tx.membershipScope.findMany({
      where: { membershipId: found.id },
      select: { propertyId: true },
    });

    return { ...found, scopes };
  });

  if (!membership) return null;

  return {
    userId: session.userId,
    userName: membership.user.name,
    email: membership.user.email,
    membershipId: membership.id,
    orgId: membership.orgId,
    orgName: membership.org.name,
    timezone: membership.org.timezone,
    role: membership.role,
    canEditOthersBookings: membership.canEditOthersBookings,
    scopedPropertyIds: membership.scopes.map((s) => s.propertyId),
    plan: membership.org.plan,
    /// When the paid plan runs out. Null on FREE, and on a plan granted with
    /// no end date. Exposed alongside `plan` because every question worth
    /// asking about a plan — has it lapsed, is it about to — needs both, and
    /// a caller with only one of them will quietly answer the wrong question.
    planUntil: membership.org.planUntil,
    limits: limitsFor(membership.org.plan, membership.org.planUntil),
  };
});

/** Same, but sends anyone without a membership to sign in. */
export async function requireMember(): Promise<ActiveMember> {
  const member = await getActiveMember();
  if (!member) redirect("/dang-nhap");
  return member;
}

/**
 * What currency this organization prices in.
 *
 * Its own function, memoised per render, because almost every screen shows
 * money and none of them should be guessing. The fallback is VND rather than
 * a throw: a missing organization means the caller is already in trouble, and
 * a dashboard that renders with the wrong symbol is better than one that
 * renders a stack trace.
 */
export const orgCurrency = cache(async (): Promise<string> => {
  const member = await getActiveMember();
  if (!member) return "VND";
  const org = await withOrg(member.orgId, (tx) =>
    tx.organization.findUnique({
      where: { id: member.orgId },
      select: { currency: true },
    }),
  );
  return org?.currency ?? "VND";
});

// Re-exported so every existing import of these keeps working: they are part
// of the data-access surface conceptually, they just do not need a request.
export {
  canManageBookings,
  canEditBooking,
  visiblePropertyFilter,
} from "@/lib/member";
export type { ActiveMember } from "@/lib/member";
