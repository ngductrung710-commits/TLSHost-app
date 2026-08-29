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

/** Saturday or Sunday, read in UTC. */
export function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** Formats minor currency units. VND has no subunit, so this is whole dong. */
export function formatVnd(amount: number, locale: "vi" | "en" = "vi"): string {
  // The grouping separator is the whole point of the parameter. Vietnamese
  // groups with a full stop — 1.200.000 — which an English reader parses as a
  // decimal and reads as one and a bit. The currency itself is the same money
  // either way, so the symbol does not move.
  return `${amount.toLocaleString(locale === "en" ? "en-GB" : "vi-VN")} ₫`;
}

const WEEKDAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The board's column headers, in whichever language the reader is using. */
export function weekday(date: Date, locale: "vi" | "en" = "vi"): string {
  return (locale === "en" ? WEEKDAYS_EN : WEEKDAYS_VI)[date.getUTCDay()];
}
