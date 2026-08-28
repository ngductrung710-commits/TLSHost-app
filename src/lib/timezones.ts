/**
 * IANA zones offered in the settings picker.
 *
 * A short list rather than the full tz database. This setting decides what
 * "today" means on every screen that shows a date, and a host in Hội An
 * scrolling past four hundred entries is likelier to pick the wrong one than
 * to find a better one. Anything outside this list is a code change, which is
 * the right amount of friction for something that shifts every date in the app.
 *
 * In its own module because a "use server" file may only export async
 * functions — the fourth time that rule has come up in this codebase.
 */
export const TIMEZONES = [
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Jakarta",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Europe/London",
  "UTC",
] as const;

export type Timezone = (typeof TIMEZONES)[number];
