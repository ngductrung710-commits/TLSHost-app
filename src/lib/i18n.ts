/**
 * The workspace's language.
 *
 * The key is the Vietnamese sentence itself, not a dotted path. That is
 * deliberate and it buys two things:
 *
 *   - A missing translation renders as Vietnamese, which is a real sentence to
 *     the people who use this product every day. The dotted-path approach
 *     renders "settings.payments.stripe.hint" on a customer's screen.
 *
 *   - The source stays readable. `t("Đăng xuất")` says what the button says;
 *     `t("nav.signOut")` requires a second file to find out.
 *
 * The cost is that editing Vietnamese copy orphans its translation. That is
 * what `npm run check:i18n` is for — it fails on both halves, a string with no
 * translation and a translation nothing says any more.
 *
 * No `server-only` here: client components need the same lookup, and they get
 * the dictionary as a prop because a function cannot cross that boundary.
 */

export type Locale = "vi" | "en";

/** Vietnamese sentence -> English sentence. Empty when the locale is Vietnamese. */
export type Dict = Record<string, string>;

export type T = (text: string) => string;

export function makeT(dict: Dict): T {
  return (text) => dict[text] ?? text;
}

/**
 * For sentences with something in the middle of them.
 *
 * `${mins} phút trước` cannot be a key — the value changes every minute — and
 * splitting it into two keys puts the word order under Vietnamese's control in
 * both languages, which gives "5 ago minutes". So the placeholder stays inside
 * the key, and each language decides where it goes:
 *
 *   "{n} phút trước"  ->  "{n} minutes ago"
 *   "Đồng bộ {khi}"   ->  "Synced {khi}"
 */
export function fill(
  text: string,
  values: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (whole, key) =>
    key in values ? String(values[key]) : whole,
  );
}

export const LOCALE_NAMES: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};
