import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { withUser } from "@/lib/db";
import { readSession } from "@/lib/session";

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

export type ActiveMember = {
  userId: string;
  userName: string;
  email: string;
  membershipId: string;
  orgId: string;
  orgName: string;
  timezone: string;
  role: "OWNER" | "COLLABORATOR" | "HOUSEKEEPER";
  canEditOthersBookings: boolean;
  /** Empty means every property in the org — see MembershipScope. */
  scopedPropertyIds: string[];
};

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
        org: { select: { name: true, timezone: true } },
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
  };
});

/** Same, but sends anyone without a membership to sign in. */
export async function requireMember(): Promise<ActiveMember> {
  const member = await getActiveMember();
  if (!member) redirect("/dang-nhap");
  return member;
}

/**
 * Guards the actions that write to the calendar.
 *
 * Housekeepers can see rooms but never bookings — the spec is explicit that
 * they should not see rates or guest payment details, and the simplest way to
 * keep that true is for them to have no path to a booking at all.
 */
export function canManageBookings(member: ActiveMember): boolean {
  return member.role === "OWNER" || member.role === "COLLABORATOR";
}

/**
 * Whether this member may touch a booking someone else created.
 *
 * Owners always may. Collaborators only if the owner turned it on. The check
 * takes the creator's membership id rather than the booking so it can be
 * called before or after loading the row.
 */
export function canEditBooking(
  member: ActiveMember,
  createdByMembershipId: string | null,
): boolean {
  if (!canManageBookings(member)) return false;
  if (member.role === "OWNER") return true;
  if (createdByMembershipId === member.membershipId) return true;
  return member.canEditOthersBookings;
}

/**
 * Narrows a property list to what this member is allowed to see.
 *
 * Row-level security already stops them reading another organization's rows.
 * This is the finer cut inside their own org, which RLS does not express —
 * it is per-membership, not per-tenant.
 */
export function visiblePropertyFilter(member: ActiveMember) {
  if (member.scopedPropertyIds.length === 0) return {};
  return { id: { in: member.scopedPropertyIds } };
}
