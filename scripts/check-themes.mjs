// Every text pairing in every booking-page theme, against WCAG.
//
//   npm run check:themes
//
// These four presets are the reason a host cannot produce an unreadable page:
// they are the only looks on offer, so each one has to hold up on its own.
// A preset that fails here ships a page a guest cannot read, and nobody would
// find out from the code review.

import { THEMES, THEME_LABELS, contrastRatio, brandColorProblem } from "../.tmp/themes.mjs";

let failures = 0;
const check = (label, ratio, need) => {
  const ok = ratio !== null && ratio >= need;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(42)} ${ratio === null ? "—" : ratio.toFixed(2)}  (cần ${need})`,
  );
};

for (const [name, t] of Object.entries(THEMES)) {
  console.log(`\n-- ${name} (${THEME_LABELS[name]})`);

  // Body text has to work on both grounds: the page and the cards on it.
  check(`body text on page`, contrastRatio(t.ink, t.bg), 4.5);
  check(`body text on card`, contrastRatio(t.ink, t.surface), 4.5);
  check(`secondary text on page`, contrastRatio(t.inkSoft, t.bg), 4.5);
  check(`secondary text on card`, contrastRatio(t.inkSoft, t.surface), 4.5);

  // A button label is text; the button's own shape is a non-text element.
  check(`button label on accent`, contrastRatio(t.onAccent, t.accent), 4.5);
  check(`accent against page`, contrastRatio(t.accent, t.bg), 3);

  // A hairline nobody can see is not a hairline. 3:1 is the non-text bar; a
  // divider is decorative, so this is reported rather than enforced.
  const line = contrastRatio(t.line, t.surface);
  console.log(
    `      ${"divider on card".padEnd(42)} ${line.toFixed(2)}  (thông tin, không bắt buộc)`,
  );
}

/* -------------------------------------------------------------------- */
console.log("\n-- brand colour validation");

const cases = [
  ["#a05436 on CLASSIC", "#a05436", "CLASSIC", null],
  ["#111111 on CLASSIC", "#111111", "CLASSIC", null],
  ["a pale yellow on CLASSIC", "#ffe680", "CLASSIC", "reject"],
  ["white on MINIMAL", "#ffffff", "MINIMAL", "reject"],
  ["not a hex", "blue", "CLASSIC", "reject"],
  ["missing hash", "a05436", "CLASSIC", "reject"],
  ["short hex", "#abc", "CLASSIC", "reject"],
];

for (const [label, hex, theme, want] of cases) {
  const problem = brandColorProblem(hex, theme);
  const ok = want === "reject" ? problem !== null : problem === null;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label.padEnd(42)} ${problem ? "refused" : "accepted"}`,
  );
  if (!ok) console.log(`      ${problem ?? "(accepted)"}`);
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
