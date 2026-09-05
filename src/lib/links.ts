import type { Locale } from "@/lib/i18n";

/**
 * The way back to the marketing site.
 *
 * The mirror of src/lib/links.ts in the tlshost repo, which points that site
 * at this application. The two halves are separate builds on separate
 * hostnames, so neither can route to the other — each holds the other's URL in
 * an environment variable, and each falls back to rendering no link at all.
 *
 * Null rather than a guess, for the reason the other file gives: a link that
 * lands on nothing is worse than no link. Locally that means running both dev
 * servers; in production it means one line in .env.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || null;

/**
 * The marketing site in this reader's language, or null when it is not
 * configured.
 *
 * The locale is part of the path rather than negotiated at the far end,
 * because that site is route-based: /vi and /en are two URLs, not one URL
 * with a cookie. Sending a guest reading in English to the Vietnamese home
 * page would undo the language they just chose.
 */
export function siteUrl(locale: Locale): string | null {
  if (!SITE_URL) return null;
  return `${SITE_URL.replace(/\/+$/, "")}/${locale}`;
}
