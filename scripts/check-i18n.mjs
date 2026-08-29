// Every Vietnamese string the workspace shows has an English one.
//
//   npm run check:i18n
//
// The switcher falls back to Vietnamese: a string with no translation renders
// as the original rather than as "settings.payments.hint", which is the right
// behaviour for the people who use this product every day. It is also the
// behaviour that lets a half-finished translation look finished — an English
// speaker gets a page of English with three Vietnamese sentences in it and
// nothing anywhere reports a problem.
//
// So completeness is checked here instead. Three rules:
//
//   1. Every Vietnamese string in the signed-in routes has an English one.
//   2. Every English entry still corresponds to something the app says.
//   3. Nothing "translates" to itself.
//
// Rule 2 matters more than it looks. The key is the Vietnamese sentence, so
// editing the Vietnamese orphans its translation silently — the app keeps
// working and quietly stops being translated. This turns that into a failure.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { EN } from "../.tmp/en.mjs";

const VI =
  /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

// The signed-in workspace only. Guest-facing pages under /dat are in the
// property's language, which is the host's choice and not a staff setting.
// src/components too: BoardGrid draws the calendar and lives there, and
// leaving it out meant the busiest screen in the product kept its Vietnamese
// tooltips while every check reported a complete translation.
const ROOTS = ["src/app/(app)", "src/app/(auth)", "src/components"];

/**
 * Label tables that live in lib but end up on a workspace screen.
 *
 * These hold keys, not output — a page renders them as t(SOURCE_LABELS[kind]).
 * They are listed here so rule 1 covers them: without it "Trực tiếp" sat on
 * the calendar of an otherwise fully English workspace, and every check passed.
 *
 * Only the label tables. The rest of lib is Vietnamese that never reaches a
 * screen — an AI system prompt, an iCal summary, a comment.
 */
const LABEL_MODULES = [
  "src/lib/board.ts",
  "src/lib/housekeeping.ts",
  "src/lib/proposals.ts",
  "src/lib/themes.ts",
  "src/lib/plans.ts",
  "src/lib/availability.ts",
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/** Comments hold a great deal of Vietnamese and none of it reaches a screen. */
function stripComments(source) {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "")
      // .describe() on a zod field is written for the model, not for a person.
      // It never renders, so requiring a translation for it would fill the
      // dictionary with entries no screen can show.
      .replace(/\.describe\(\s*(["'])(?:(?!\1)[^\\\n]|\\.)*\1\s*,?\s*\)/g, ".describe(D)")
  );
}

/**
 * Is this offset inside a top-level `function`, rather than a `const` table?
 *
 * Both hold Vietnamese, and only one of them is a bug. A literal in a function
 * is about to be rendered; a literal in a module-level object is a key that
 * something else translates when it reads it.
 */
function insideFunction(code, at) {
  let owner = null;
  for (const m of code.matchAll(/^(export default |export )?(async )?(function|const|class)\b/gm)) {
    if (m.index > at) break;
    owner = m[3];
  }
  return owner === "function" || owner === "class";
}

let failures = 0;
const fail = (file, message) => {
  failures += 1;
  console.log(`FAIL  ${file}\n      ${message}`);
};

const found = new Set();
const unwrappedJsx = [];

console.log("-- every Vietnamese string in the workspace has an English one");

const FILES = [...ROOTS.flatMap((root) => walk(root)), ...LABEL_MODULES];

for (const group of [FILES]) {
  for (const file of group) {
    const isLabelModule = LABEL_MODULES.includes(file);
    const code = stripComments(readFileSync(file, "utf8"));

    // Every string literal, wrapped or not. A module-level constant — a zod
    // message, an error string — is a key too: it is translated where it is
    // rendered, by t(state.error).
    for (const m of code.matchAll(/(["'])((?:(?!\1)[^\\\n])*)\1/g)) {
      if (!VI.test(m[2])) continue;
      found.add(m[2]);
      if (!(m[2] in EN)) fail(file, `no English for ${JSON.stringify(m[2])}`);
    }

    // JSX text and attribute values are rendered straight to the screen, so
    // unlike a constant they have to be wrapped right here.
    // The trailing comma matters: prettier wraps a long call as
    //   t(\n  "một câu rất dài…",\n)
    // and without allowing that comma every long translated string here reads
    // as an unwrapped one.
    const withoutCalls = code.replace(
      /\bt\(\s*(["'])((?:(?!\1)[^\\\n])*)\1\s*,?\s*\)/g,
      "T",
    );
    // `>` and `}` both open a run of JSX text; `<` and `{` both close one.
    // Matching only `>`…`<` misses text sitting between two expressions, which
    // is exactly where the plan card's "/ tháng" was hiding — found by reading
    // the page, not by this check, which is the wrong way round.
    for (const m of withoutCalls.matchAll(
      /[>}][ \t\n]*([^<>{}"'`]*[^<>{}"'`\s])[ \t\n]*[<{]/g,
    )) {
      const text = m[1].replace(/\s+/g, " ").trim();
      if (VI.test(text)) unwrappedJsx.push([file, text]);
    }
    for (const m of withoutCalls.matchAll(/[a-zA-Z-]+=("([^"\n]*)")/g)) {
      if (VI.test(m[2])) unwrappedJsx.push([file, m[2]]);
    }

    if (isLabelModule) continue;

    // A static `export const metadata` is evaluated once at module scope, with
    // no request and so no cookie. Its title cannot be translated, and the
    // browser tab stayed Vietnamese for an English reader on all sixteen
    // pages while everything visible on them read as translated.
    for (const m of code.matchAll(/export const metadata[^;]*?title:\s*"([^"]*)"/gs)) {
      if (VI.test(m[1])) {
        fail(
          file,
          `title cannot be translated from a static metadata export — use generateMetadata: ${JSON.stringify(m[1])}`,
        );
      }
    }

    // And literals inside a JSX expression — {pending ? "Đang lưu…" : label}.
    // Those are neither text nodes nor attributes, so both rules above walk
    // past them, and they render Vietnamese in an English workspace with
    // nothing to show for it. The whole first sweep of this file passed while
    // half the submit buttons were still untranslated.
    //
    // The exception is a module-level lookup table: those hold keys that get
    // translated where they are read, by t(copy.secretHint). So a literal is
    // only a failure if it sits inside a function.
    if (file.endsWith(".tsx")) {
      for (const m of withoutCalls.matchAll(/(["'])((?:(?!\1)[^\\\n])*)\1/g)) {
        if (!VI.test(m[2])) continue;
        if (!insideFunction(withoutCalls, m.index)) continue;
        unwrappedJsx.push([file, m[2]]);
      }
    }
  }
}

if (failures === 0) console.log(`PASS  ${found.size} strings, all translated`);

console.log("\n-- rendered text is wrapped, not just present in the dictionary");
for (const [file, text] of unwrappedJsx) {
  fail(file, `not wrapped in t(): ${JSON.stringify(text)}`);
}
if (unwrappedJsx.length === 0) console.log("PASS  nothing rendered untranslated");

console.log("\n-- the dictionary says nothing the app stopped saying");
const stale = Object.keys(EN).filter((key) => !found.has(key));
for (const key of stale) fail("src/i18n/en.ts", `no longer in the app: ${JSON.stringify(key)}`);
if (stale.length === 0) {
  console.log(`PASS  ${Object.keys(EN).length} entries, all still in use`);
}

console.log("\n-- nothing translates to itself");
// A copied-across value reads as done and is not. Proper nouns are the honest
// exception, and none of them carry Vietnamese diacritics.
const echoes = Object.entries(EN).filter(([, value]) => VI.test(value));
for (const [key, value] of echoes) {
  fail("src/i18n/en.ts", `still Vietnamese: ${JSON.stringify(key)} -> ${JSON.stringify(value)}`);
}
if (echoes.length === 0) console.log("PASS  no untranslated values");

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
