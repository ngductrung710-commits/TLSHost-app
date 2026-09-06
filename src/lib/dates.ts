/**
 * Calendar dates, kept away from clocks.
 *
 * A night is a date in the property's timezone, not an instant. The database
 * stores DATE and hands back a JS Date pinned to UTC midnight; the danger is
 * everything in between, because `new Date("2026-07-12")` parses as UTC while
 * `new Date(2026, 6, 12)` and `.getDate()` are local. Mixing the two shifts
 * dates by a day for anyone west of Greenwich, which is a bug that reaches a
 * guest before it reaches a test.
 *
 * So: one representation on the wire ("YYYY-MM-DD"), one in memory (a Date at
 * UTC midnight), and every accessor below is a UTC accessor. There is no
 * local-time reading of a calendar date anywhere in this file, and there
 * should not be one anywhere else either.
 */

import { currencySymbol, currencySymbolAfter } from "@/lib/currencies";

/** A calendar date as "YYYY-MM-DD". What forms submit and URLs carry. */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses "YYYY-MM-DD" to UTC midnight. Returns null if it is not a real date. */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejects the dates that parse but roll over, like 2026-02-30.
  if (toIsoDate(date) !== value) return null;
  return date;
}

/** Formats a Date as "YYYY-MM-DD", reading it in UTC. */
export function toIsoDate(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

/** Whole days between two calendar dates. Nights in a stay = this. */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Every date in [from, to), in order. Half-open, like everything else here. */
export function eachDate(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * Today in the given IANA zone, as UTC midnight.
 *
 * A host in Hội An opening the board at 00:30 must see the 12th, not the 11th
 * that a UTC reading of the same instant would give. `en-CA` is used only
 * because it formats as YYYY-MM-DD; the zone is what does the work.
 */
export function todayIn(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00.000Z`);
}

const WEEKDAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** "T2" … "CN". UTC day-of-week, to match how these dates are stored. */
export function weekdayVi(date: Date): string {
  return WEEKDAYS_VI[date.getUTCDay()];
}

/** Day of month, unpadded. */
export function dayOfMonth(date: Date): number {
  return date.getUTCDate();
}

/** "12/7" — the short form used on the board. */
export function shortVi(date: Date): string {
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}`;
}

const MONTHS_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * A short date a guest cannot misread.
 *
 * "4/9" is the fourth of September to a Vietnamese reader and the ninth of
 * April to an American one, and the guest reading it is deciding which nights
 * to pay for. So the English form names the month — "4 Sep" — rather than
 * reordering two numbers that look equally plausible either way.
 */
export function shortDate(date: Date, locale: "vi" | "en" = "vi"): string {
  return locale === "en"
    ? `${date.getUTCDate()} ${MONTHS_EN[date.getUTCMonth()]}`
    : shortVi(date);
}

/**
 * The same date with the year, for anything that outlives the screen.
 *
 * shortDate above drops the year on purpose: it is read next to a calendar
 * that already says which month is on show. A confirmation email has no such
 * context — it is opened months later, and "10 Mar" in a letter about a
 * booking six months out is a date the reader has to guess the year of.
 */
export function fullDate(date: Date, locale: "vi" | "en" = "vi"): string {
  return locale === "en"
    ? `${shortDate(date, "en")} ${date.getUTCFullYear()}`
    : `${shortVi(date)}/${date.getUTCFullYear()}`;
}

/** Saturday or Sunday, read in UTC. */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * A host's money, in whatever currency that host prices in.
 *
 * The grouping separator is why the locale is a parameter. Vietnamese groups
 * with a full stop — 1.200.000 — which an English reader parses as a decimal
 * and reads as one and a bit.
 *
 * The symbol moves as well as the separator: ₫ trails the number and $ leads
 * it. This used to be hardcoded to ₫ for every screen in the app, which was
 * invisible while every organization priced in đồng and wrong the moment one
 * did not — a room at seventy-six dollars rendered as "76 ₫", a price no
 * guest would believe and no host would have set.
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale: "vi" | "en" = "vi",
): string {
  const digits = amount.toLocaleString(locale === "en" ? "en-GB" : "vi-VN");
  const symbol = currencySymbol(currency);
  return currencySymbolAfter(currency) ? `${digits} ${symbol}` : `${symbol}${digits}`;
}

/**
 * What TLSHost charges a host for a plan — always đồng, never theirs.
 *
 * Kept separate from formatMoney on purpose. Our own prices are quoted in
 * đồng and collected by Vietnamese bank transfer, so they do not follow the
 * host's currency, and a plan page that starts saying "$690.000" because a
 * host switched their rooms to dollars would be quoting a price nobody can
 * pay.
 */
export function formatPlanPrice(amount: number, locale: "vi" | "en" = "vi"): string {
  return `${amount.toLocaleString(locale === "en" ? "en-GB" : "vi-VN")} ₫`;
}

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The board's column headers, in whichever language the reader is using. */
export function weekday(date: Date, locale: "vi" | "en" = "vi"): string {
  return (locale === "en" ? WEEKDAYS_EN : WEEKDAYS_VI)[date.getUTCDay()];
}
