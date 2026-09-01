// The arithmetic behind buying a month.
//
//   npm run check:billing
//
// Every case here is one where being wrong costs somebody real days of a plan
// they paid for, and none of them are visible by reading the code — a month is
// not thirty days, and "extend" and "replace" are the same line of code until
// the host is a week into the month they already bought.

import {
  PURCHASE_MONTHS,
  addMonths,
  periodFor,
  priceFor,
  wouldShorten,
} from "../.tmp/billing.mjs";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const iso = (d) => d.toISOString().slice(0, 10);
const at = (s) => new Date(`${s}T00:00:00.000Z`);

/* -------------------------------------------------------------------- */
console.log("-- a month is a calendar month, not thirty days");

check("15 Jan + 1", iso(addMonths(at("2026-01-15"), 1)), "2026-02-15");
check("31 Jan + 1 clamps to the end of February", iso(addMonths(at("2026-01-31"), 1)), "2026-02-28");
check("31 Jan + 1 in a leap year", iso(addMonths(at("2028-01-31"), 1)), "2028-02-29");
check("31 Mar + 1 clamps to 30 April", iso(addMonths(at("2026-03-31"), 1)), "2026-04-30");
check("31 Dec + 1 crosses the year", iso(addMonths(at("2026-12-31"), 1)), "2027-01-31");
check("28 Feb + 1 does not stick to month ends", iso(addMonths(at("2026-02-28"), 1)), "2026-03-28");
// Thirty days would have said 2026-03-02 for the January case above. That is
// two days of a plan given away every January, to everyone.

/* -------------------------------------------------------------------- */
console.log("\n-- buying again extends, it does not replace");

const now = at("2026-06-10");

check(
  "never bought before starts today",
  iso(periodFor(null, now).end),
  "2026-07-10",
);
check(
  "lapsed last month starts today, not backdated into the gap",
  iso(periodFor(at("2026-05-01"), now).end),
  "2026-07-10",
);
check(
  "still inside a month adds to its end",
  iso(periodFor(at("2026-06-25"), now).end),
  "2026-07-25",
);
check(
  "…and the period starts where the old one ended",
  iso(periodFor(at("2026-06-25"), now).start),
  "2026-06-25",
);
check(
  "expiring today is treated as expired",
  iso(periodFor(now, now).end),
  "2026-07-10",
);

// The one that pays for this whole file: a host fifteen days into a month who
// buys another must end up with forty-five days, not thirty.
const buyingEarly = periodFor(at("2026-06-25"), now);
const daysHeld = Math.round((buyingEarly.end - now) / 86_400_000);
check("fifteen days left plus a month is forty-five days", daysHeld, 45);

/* -------------------------------------------------------------------- */
console.log("\n-- an unlimited plan is not shortened by buying one");

check("FREE with no date can buy", wouldShorten("FREE", null), false);
check("PRO granted with no end date is flagged", wouldShorten("PRO", null), true);
check("PRO with an end date can buy", wouldShorten("PRO", at("2026-07-01")), false);
check("lapsed PRO can buy", wouldShorten("PRO", at("2020-01-01")), false);

/* -------------------------------------------------------------------- */
console.log("\n-- price");

check("one month of PRO is one month of the monthly price", priceFor(690_000), 690_000);
check("three months multiplies", priceFor(690_000, 3), 2_070_000);
check("a purchase buys one month", PURCHASE_MONTHS, 1);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
