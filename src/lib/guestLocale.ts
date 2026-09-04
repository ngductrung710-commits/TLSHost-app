import "server-only";

import { headers } from "next/headers";

import { makeT, type Locale, type T } from "@/lib/i18n";
import { dictFor } from "@/lib/locale";

/**
 * Which language a *guest* reads a booking page in.
 *
 * Deliberately not the cookie in src/lib/locale.ts. That cookie is the staff
 * language, a property of one person sitting in the workspace, and a manager
 * switching their own screen to English must not switch a stranger's booking
 * page with it. These are two different questions that happen to have the
 * same two answers.
 *
 * The URL wins, because the guest asked. Absent that, the browser's own
 * Accept-Language decides, which is the closest thing to asking without
 * making them click anything.
 */

/** The query parameter, Vietnamese-keyed like `tu`, `den` and `dat`. */
export const GUEST_LOCALE_PARAM = "ng";

/**
 * Read the header rather than guessing from it.
 *
 * Accept-Language is a q-ordered list — "fr-CH, fr;q=0.9, en;q=0.8, vi;q=0.7"
 * — and the order is the whole point. Taking the first tag and testing it for
 * "vi" would read that header as Vietnamese, which it is not; taking the
 * first tag that is one of ours reads it as English, which it is.
 *
 * A header naming neither falls to Vietnamese: this is a Vietnamese
 * property's page, and a language switcher sits at the top for anyone the
 * default does not suit.
 */
export function guestLocaleFrom(
  param: unknown,
  acceptLanguage: string | null,
): Locale {
  if (param === "en") return "en";
  if (param === "vi") return "vi";

  for (const entry of (acceptLanguage ?? "").split(",")) {
    // Only the tag matters here; the q value is already expressed by the
    // order the header arrives in.
    const tag = entry.split(";")[0]?.trim().toLowerCase() ?? "";
    const primary = tag.split("-")[0];
    if (primary === "vi") return "vi";
    if (primary === "en") return "en";
  }

  return "vi";
}

/** The same, for a page that has its searchParams in hand. */
export async function guestLocale(
  params: Record<string, string | string[] | undefined>,
): Promise<Locale> {
  const raw = params[GUEST_LOCALE_PARAM];
  const head = await headers();
  return guestLocaleFrom(
    typeof raw === "string" ? raw : undefined,
    head.get("accept-language"),
  );
}

/** A translator for a guest page. */
export function guestT(locale: Locale): T {
  return makeT(dictFor(locale));
}

/**
 * The current URL with the language swapped, so the switcher keeps a guest
 * where they were — their dates, their chosen room — instead of returning
 * them to the top of the page in another language.
 */
export function withLocale(
  params: Record<string, string | string[] | undefined>,
  locale: Locale,
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === GUEST_LOCALE_PARAM) continue;
    if (typeof value === "string") next.set(key, value);
    else if (Array.isArray(value)) for (const v of value) next.append(key, v);
  }
  // Vietnamese is the default, so it is the absence of the parameter — the
  // same rule the staff cookie follows.
  if (locale === "en") next.set(GUEST_LOCALE_PARAM, "en");
  const query = next.toString();
  return query === "" ? "" : `?${query}`;
}
