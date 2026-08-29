import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { withUser } from "@/lib/db";
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
  const membership = await withUser(session.userId, (tx) =>
    tx.membership.findFirst({
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
        scopes: { select: { propertyId: true } },
      },
    }),
  );

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
    limits: limitsFor(membership.org.plan, membership.org.planUntil),
  };
});

/** Same, but sends anyone without a membership to sign in. */
export async function requireMember(): Promise<ActiveMember> {
  const member = await getActiveMember();
  if (!member) redirect("/dang-nhap");
  return member;
}

// Re-exported so every existing import of these keeps working: they are part
// of the data-access surface conceptually, they just do not need a request.
export {
  canManageBookings,
  canEditBooking,
  visiblePropertyFilter,
} from "@/lib/member";
export type { ActiveMember } from "@/lib/member";
