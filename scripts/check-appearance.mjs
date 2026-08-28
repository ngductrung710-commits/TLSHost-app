// Every text pairing the app uses, in light and in dark.
//
//   npm run check:appearance
//
// The dark palette redefines roles rather than inventing colours, and the
// claim in globals.css is that pairings passing in light also pass in dark.
// This is what makes that a fact rather than an intention. It reads the
// stylesheet itself, so a token edited without re-checking is caught here
// rather than by someone squinting at a screen.

import { readFileSync } from "node:fs";

const css = readFileSync("src/app/globals.css", "utf8");

/**
 * Pulls one --color-* block into a map.
 *
 * Brace-counted from the section's own opening brace. The first version took
 * the next "}" after the next "{", which for @theme — a block containing no
 * nested braces — ran past the end and swallowed the dark block that follows.
 * Both palettes then read as dark, and the check reported twelve passes on a
 * comparison it was not making.
 */
function tokens(sectionStart, sectionLabel) {
  const from = css.indexOf(sectionStart);
  if (from < 0) throw new Error(`section not found: ${sectionLabel}`);

  let depth = 0;
  let end = -1;
  for (let i = from; i < css.length; i++) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end < 0) throw new Error(`unterminated section: ${sectionLabel}`);

  const out = {};
  for (const m of css.slice(from, end).matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)) {
    out[m[1]] = m[2];
  }
  return out;
}

const light = tokens("@theme {", "light");
const dark = tokens(':root[data-theme="dark"] {', "dark");

// Dark redefines only some tokens; anything it leaves alone keeps its light
// value, which is exactly how the cascade behaves at runtime.
const darkFull = { ...light, ...dark };

const ch = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
};
const cr = (a, b) => {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

// Every pairing the app actually renders, named as it appears in the code.
const PAIRS = [
  ["body text on canvas", "ink-900", "canvas", 4.5],
  ["body text on surface", "ink-900", "surface", 4.5],
  ["secondary text on surface", "ink-600", "surface", 4.5],
  ["secondary text on canvas", "ink-600", "canvas", 4.5],
  ["muted text on surface", "ink-500", "surface", 4.5],
  ["muted text on canvas", "ink-500", "canvas", 4.5],
  ["faint labels on surface", "ink-400", "surface", 3],
  ["accent text on surface", "clay-600", "surface", 4.5],
  ["accent text on canvas", "clay-500", "canvas", 4.5],
  ["positive on its soft ground", "positive", "positive-soft", 4.5],
  ["warning on its soft ground", "warning", "warning-soft", 4.5],
  ["danger on its soft ground", "danger", "danger-soft", 4.5],
  ["control border on canvas", "line-strong", "canvas", 3],
  ["control border on surface", "line-strong", "surface", 3],
];

let failures = 0;

for (const [label, palette] of [["LIGHT", light], ["DARK", darkFull]]) {
  console.log(`\n-- ${label}`);
  for (const [name, fg, bg, need] of PAIRS) {
    const a = palette[fg];
    const b = palette[bg];
    if (!a || !b) {
      failures += 1;
      console.log(`FAIL  ${name.padEnd(32)} missing token ${!a ? fg : bg}`);
      continue;
    }
    const ratio = cr(a, b);
    const ok = ratio >= need;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${name.padEnd(32)} ${ratio.toFixed(2).padStart(5)}  (cần ${need})  ${a} on ${b}`,
    );
  }
}

// The dark block and the prefers-color-scheme block must stay identical: two
// copies that drift means the toggle and the system setting disagree, and the
// person who notices is a host whose screen changes when they navigate.
const auto = tokens('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {', "auto-dark");
const sameKeys =
  Object.keys(dark).length === Object.keys(auto).length &&
  Object.keys(dark).every((k) => dark[k] === auto[k]);
if (!sameKeys) failures += 1;
console.log(
  `\n${sameKeys ? "PASS" : "FAIL"}  data-theme="dark" and prefers-color-scheme agree (${Object.keys(dark).length} tokens)`,
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
