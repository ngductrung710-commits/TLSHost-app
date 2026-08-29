import "server-only";

import { cookies } from "next/headers";

import { EN } from "@/i18n/en";
import { makeT, type Dict, type Locale, type T } from "@/lib/i18n";

/**
 * Which language this person is reading the workspace in.
 *
 * A cookie, for the same reason light/dark is one: this is a property of the
 * person, not of the business. A Vietnamese owner and an English-speaking
 * manager share one organization and one set of bookings, and neither should
 * have to change the other's screen to read their own.
 *
 * This is the *staff* language only. What a guest sees on a booking page is
 * the property's choice, not a staff member's, and is decided separately — a
 * manager switching to English must not switch the public page with it.
 */

const COOKIE = "tlshost_lang";

export async function readLocale(): Promise<Locale> {
  return (await cookies()).get(COOKIE)?.value === "en" ? "en" : "vi";
}

export async function writeLocale(locale: Locale): Promise<void> {
  const jar = await cookies();
  if (locale === "vi") {
    // Vietnamese is the default, so it is the absence of a cookie rather than
    // a cookie saying "vi". One less thing to keep in step with itself.
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, locale, {
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function dictFor(locale: Locale): Dict {
  return locale === "en" ? EN : {};
}

/** For server components and server actions. */
export async function getT(): Promise<T> {
  return makeT(dictFor(await readLocale()));
}

/** For handing to a client component, which cannot receive a function. */
export async function getDict(): Promise<Dict> {
  return dictFor(await readLocale());
}
