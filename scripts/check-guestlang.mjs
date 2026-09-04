// Which language a guest gets, and what the switcher links to.
//
//   npm run check:guestlang
//
// Two rules live here and both are easy to get subtly wrong.
//
// The first is that Accept-Language is a *ranked* list. "fr-CH, fr;q=0.9,
// en;q=0.8" is a Swiss French speaker who also reads English, and the right
// answer is English — but only if the list is read in order. Testing the
// first tag for "vi" and then for "en" reads that header as neither and
// falls back to Vietnamese, which is a plausible-looking implementation that
// hands an English reader a page they cannot read.
//
// The second is that switching language must not lose the guest's place. A
// switcher that drops ?tu= and ?den= sends someone who was looking at a
// specific week back to today, in the other language, having lost the thing
// they came to do.

import { guestLocaleFrom, withLocale } from "../.tmp/guestlang.mjs";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

/* -------------------------------------------------------------------- */
console.log("-- the URL wins, because the guest asked");

check("ng=en", guestLocaleFrom("en", "vi-VN,vi;q=0.9"), "en");
check("ng=vi", guestLocaleFrom("vi", "en-US,en;q=0.9"), "vi");
check("an unknown value is ignored", guestLocaleFrom("de", "en-US"), "en");
check("an array is not a value", guestLocaleFrom(["en"], "en-US"), "en");

/* -------------------------------------------------------------------- */
console.log("\n-- otherwise the browser decides, in its own order");

check("plain English", guestLocaleFrom(undefined, "en-US,en;q=0.9"), "en");
check("plain Vietnamese", guestLocaleFrom(undefined, "vi-VN,vi;q=0.9"), "vi");

// The case that separates a real implementation from a plausible one.
check(
  "Swiss French who also reads English gets English",
  guestLocaleFrom(undefined, "fr-CH,fr;q=0.9,en;q=0.8"),
  "en",
);
check(
  "…and Vietnamese first still wins over English second",
  guestLocaleFrom(undefined, "vi-VN,vi;q=0.9,en;q=0.8"),
  "vi",
);
check(
  "English first wins over Vietnamese second",
  guestLocaleFrom(undefined, "en-GB,en;q=0.9,vi;q=0.8"),
  "en",
);

/* -------------------------------------------------------------------- */
console.log("\n-- and Vietnamese is what is left");

check("a header naming neither", guestLocaleFrom(undefined, "de-DE,de;q=0.9"), "vi");
check("no header at all", guestLocaleFrom(undefined, null), "vi");
check("an empty header", guestLocaleFrom(undefined, ""), "vi");
check("whitespace and case", guestLocaleFrom(undefined, "  EN-us "), "en");

/* -------------------------------------------------------------------- */
console.log("\n-- the switcher keeps the guest where they were");

const dates = { tu: "2026-09-10", den: "2026-09-12" };

// These four used to expect no parameter for Vietnamese, on the grounds that
// Vietnamese is the default — the rule the staff cookie follows. They passed,
// and they were wrong, and what they were protecting was a switcher that did
// nothing.
//
// A missing cookie can only mean "has not chosen". A missing parameter here
// means that too, but "has not chosen" is answered by Accept-Language rather
// than by Vietnamese. So on an English browser the "Tiếng Việt" link pointed
// at a URL the header then answered in English: it navigated, the page came
// back identical, and the button looked broken because it was.
check("to English, dates kept", withLocale(dates, "en"), "?tu=2026-09-10&den=2026-09-12&ng=en");
check("to Vietnamese, dates kept and said out loud", withLocale(dates, "vi"), "?tu=2026-09-10&den=2026-09-12&ng=vi");
check("an existing ng is replaced, not doubled", withLocale({ ...dates, ng: "en" }, "vi"), "?tu=2026-09-10&den=2026-09-12&ng=vi");
check("nothing to keep, English", withLocale({}, "en"), "?ng=en");
check("nothing to keep, Vietnamese", withLocale({}, "vi"), "?ng=vi");
check("undefined values are dropped", withLocale({ tu: undefined, den: "2026-09-12" }, "vi"), "?den=2026-09-12&ng=vi");

/* -------------------------------------------------------------------- */
console.log("\n-- and the round trip: a choice outlives the browser it was made on");

// The invariant the switcher actually needs, tested end to end rather than in
// two halves that each look fine. Build the link, read the parameter back out
// of it, and resolve it against the *opposite* browser language — which is
// precisely the guest the switcher exists for.
const roundTrip = (chosen, header) => {
  const query = new URLSearchParams(withLocale(dates, chosen).slice(1));
  return guestLocaleFrom(query.get("ng") ?? undefined, header);
};

check("chose Vietnamese on an English browser", roundTrip("vi", "en-US,en;q=0.9"), "vi");
check("chose English on a Vietnamese browser", roundTrip("en", "vi-VN,vi;q=0.9"), "en");
check("chose Vietnamese on a German browser", roundTrip("vi", "de-DE,de;q=0.9"), "vi");
check("chose English on a German browser", roundTrip("en", "de-DE,de;q=0.9"), "en");

/* -------------------------------------------------------------------- */
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
