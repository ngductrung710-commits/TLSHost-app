import type { Locale } from "@/lib/i18n";

/**
 * Showing a price in the reader's currency, without pretending to charge it.
 *
 * A guest reading the page in Vietnamese wants đồng, and a guest reading it in
 * English wants dollars. That is a display question. What the card is actually
 * charged is a different question with a different answer: the organization's
 * own currency, which is the only one its payment provider was set up for and
 * the only one the booking is recorded in.
 *
 * Keeping those two apart is the whole point of this file. Every converted
 * figure is approximate and has to be labelled as such wherever it is shown —
 * see "Thanh toán bằng {tien}" on the booking page. A converted number
 * presented as the price is how a guest ends up feeling overcharged by the
 * difference, however small.
 */

/**
 * Fixed, and stale the day it is written.
 *
 * Nothing here fetches a live rate. That is a deliberate limit rather than an
 * omission: a live rate means an outbound call on every page render, a cache,
 * a decision about what to show when the feed is down, and a price that moves
 * between the moment a guest reads it and the moment they press pay. For a
 * figure that is explicitly labelled approximate, none of that buys anything.
 *
 * It does mean somebody has to change this when the rate drifts. Hence the
 * environment variable: the number moves without a deploy.
 */
const DEFAULT_VND_PER_USD = 26_300;

export function vndPerUsd(): number {
  const raw = process.env.TLSHOST_VND_PER_USD;
  if (!raw) return DEFAULT_VND_PER_USD;
  const parsed = Number(raw);
  // A misconfigured rate must not silently become NaN or zero and take every
  // price on the page with it. Falling back is safer than rendering "NaN ₫".
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_VND_PER_USD;
  return parsed;
}

/** What a guest reading in this language expects to see prices in. */
export function displayCurrencyFor(locale: Locale): string {
  return locale === "en" ? "USD" : "VND";
}

/**
 * Round to something a person would say out loud.
 *
 * 894.200 ₫ is a conversion; 894.000 ₫ is a price. The false precision of the
 * first invites a guest to check the arithmetic against a figure that is
 * approximate anyway, and a room rate quoted to the nearest đồng reads as a
 * machine's answer rather than a host's.
 *
 * Dollars round to whole units for the same reason, and because every price
 * this product stores is already a whole unit.
 */
function tidy(amount: number, currency: string): number {
  if (currency === "VND") return Math.round(amount / 1000) * 1000;
  return Math.round(amount);
}

export type Shown = {
  amount: number;
  currency: string;
  /** True when this is a conversion, and therefore approximate. */
  converted: boolean;
};

/**
 * The figure to put on screen, and whether it is the real one.
 *
 * Returns the settlement amount unchanged whenever the two currencies agree,
 * or whenever the pair is one this cannot convert — an unconvertible pair
 * shows the true price rather than a guess or a blank.
 */
export function shownPrice(
  amount: number,
  settlement: string,
  locale: Locale,
): Shown {
  const want = displayCurrencyFor(locale);
  const from = settlement.toUpperCase();

  if (from === want) return { amount, currency: from, converted: false };

  const rate = vndPerUsd();
  if (from === "USD" && want === "VND") {
    return { amount: tidy(amount * rate, "VND"), currency: "VND", converted: true };
  }
  if (from === "VND" && want === "USD") {
    return { amount: tidy(amount / rate, "USD"), currency: "USD", converted: true };
  }

  // Anything else — a host pricing in euros, say. Better the true price in a
  // currency the reader did not ask for than a converted one through a rate
  // this file does not have.
  return { amount, currency: from, converted: false };
}
