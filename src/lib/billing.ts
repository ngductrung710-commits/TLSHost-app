/**
 * Buying a month of a paid plan, once.
 *
 * Not a subscription. Nothing recurs, nothing is stored to charge again, and
 * there is no card on file to expire — a host pays for a month and gets a
 * month. When it runs out the plan lapses back to FREE on its own, which
 * effectivePlan() already does, and nothing is deleted.
 *
 * That shape is deliberate for this market: a Vietnamese host paying by bank
 * transfer has no mental model for "we will take 690.000 ₫ from you every
 * month until you tell us to stop", and no card to hang it on either. Paying
 * again is a decision they make each time, which is also the honest thing to
 * sell.
 *
 * This module is the part that is the same whoever takes the money. The rail —
 * bank transfer, MoMo, PayPal, a card — decides only how a purchase gets from
 * PENDING to PAID. What a paid purchase then does to the organization is here,
 * in one place, so a second rail cannot compute the dates differently from the
 * first.
 */

/** What one purchase buys. */
export const PURCHASE_MONTHS = 1;

/**
 * Add whole calendar months, clamping the day.
 *
 * Not 30 days. A month bought on the 31st of January ends on the 28th of
 * February, not the 2nd of March, because "một tháng" is a calendar month to
 * everyone who is not a computer. Date's own rollover would quietly hand out
 * the extra days, so the day is clamped to the last one the target month has.
 */
export function addMonths(from: Date, months: number): Date {
  const day = from.getUTCDate();
  const out = new Date(
    Date.UTC(
      from.getUTCFullYear(),
      from.getUTCMonth() + months,
      1,
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
  // Day 0 of the following month is the last day of this one.
  const lastDay = new Date(
    Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0),
  ).getUTCDate();
  out.setUTCDate(Math.min(day, lastDay));
  return out;
}

/**
 * The period a purchase buys, given what the organization already has.
 *
 * Starts from whichever is later: now, or the end of the plan they are still
 * inside. Buying a second month while the first has a week left has to add to
 * that week rather than replace it — starting from `now` would silently
 * confiscate days the host already paid for, which is the kind of arithmetic
 * error nobody notices until they are the one it happened to.
 *
 * A `planUntil` in the past is a lapsed plan, so the new period starts today
 * rather than backdating into the gap.
 */
export function periodFor(
  planUntil: Date | null,
  now: Date,
  months: number = PURCHASE_MONTHS,
): { start: Date; end: Date } {
  const start =
    planUntil !== null && planUntil.getTime() > now.getTime() ? planUntil : now;
  return { start, end: addMonths(start, months) };
}

/** Whole dong for one purchase of a plan, from the plan's monthly price. */
export function priceFor(monthlyPrice: number, months: number = PURCHASE_MONTHS): number {
  return monthlyPrice * months;
}

/**
 * Would buying a month make things *worse* than what the org already has?
 *
 * A paid plan with no end date is what the operator script sets when it grants
 * one indefinitely. periodFor() would answer "one month from today" for it,
 * which is not an extension — it is a cap, quietly applied to somebody who had
 * no limit. Nothing about the dates alone can tell that case apart from a FREE
 * org, whose planUntil is also null, so the plan has to be part of the
 * question.
 */
export function wouldShorten(plan: string, planUntil: Date | null): boolean {
  return plan !== "FREE" && planUntil === null;
}
