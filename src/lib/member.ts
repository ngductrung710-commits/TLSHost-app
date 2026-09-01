import type { Plan, PlanLimits } from "@/lib/plans";

/**
 * Who is asking, and what they are allowed to see.
 *
 * Split out of dal.ts, which imports cookies() and redirect() and so can only
 * load inside a request. Everything here is a plain type and three pure
 * functions of it, which means a query module can ask "which properties may
 * this member see" without becoming un-testable outside Next.
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

  /// What this organization is allowed to do. Resolved once here so no page
  /// has to remember to check the expiry, and every gate reads the same
  /// answer.
  plan: Plan;
  /**
   * When the paid plan runs out. Null on FREE, and on a plan granted with no
   * end date.
   *
   * Beside `plan` because every question worth asking needs both: "PRO" alone
   * cannot say whether it lapsed last week, and `limits` has already resolved
   * that away. A caller with one of the three will quietly answer a different
   * question from the one it meant to ask.
   */
  planUntil: Date | null;
  limits: PlanLimits;
};

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
