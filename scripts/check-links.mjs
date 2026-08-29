// Every route is reachable, and every link goes somewhere.
//
//   npm run check:links
//
// This exists because of a bug I shipped. Trimming the sidebar from eight
// entries to six dropped three screens; two were given another way in and the
// third, /tro-ly, was not. It stayed in the build, fully working, with nothing
// anywhere in the app pointing at it — the assistant simply stopped existing
// as far as anyone using the product could tell. Nothing failed. The build was
// green, every check passed, and the page still rendered if you typed the URL.
//
// Two directions, which fail differently and so are scanned differently:
//
//   orphan — a route nothing links to. Invisible; the feature is just gone.
//            Scanned bluntly, because a missed link here invents a failure,
//            and a checker that cries wolf gets switched off. Over-counting
//            links can only hide an orphan, never fabricate one.
//
//   broken — a link to a route that does not exist. Scanned precisely, from
//            href= and redirect() only, because here the blunt scan picks up
//            "/sw.js", "/ tháng" out of a translation, and every truncated
//            prefix of a template literal.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const APP = "src/app";

/** Routes that are meant to be reached without an in-app link. */
const ENTRY_POINTS = new Set([
  "/", // the root redirect
  "/dang-nhap", // typed, bookmarked, or redirected to when signed out
  "/dang-ky", // linked from the marketing site, which is a separate repo
  "/offline", // served by the service worker, never linked
  "/tong-quan", // the post-sign-in landing page
  "/buong-phong", // where housekeepers are sent, and their rail's first entry
  "/tham-gia/[token]", // sent to someone over Zalo as an absolute URL
  "/feed/[token]", // pasted into an OTA's calendar import, not clicked
]);

const isGroup = (segment) => segment.startsWith("(") && segment.endsWith(")");

function routes(dir = APP, url = "") {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!statSync(full).isDirectory()) {
      // route.ts answers a URL just as page.tsx does — the iCal feed is one.
      if (/^(page|route)\.tsx?$/.test(entry)) found.push(url === "" ? "/" : url);
      continue;
    }
    found.push(...routes(full, isGroup(entry) ? url : `${url}/${entry}`));
  }
  return [...new Set(found)];
}

/**
 * Only the files the app actually reaches, walked from the route entry points
 * through their imports.
 *
 * Reading all of src/ instead was this file's own first bug. With the
 * assistant tab unmounted from the layout, AssistantTab.tsx still sat on disk
 * containing href="/tro-ly" — so the orphan check read that link, decided
 * /tro-ly was reachable, and passed. A check that cannot fail on the exact
 * bug it was written for is worse than no check: it is the same silence, now
 * wearing a PASS.
 *
 * Walking imports fixes both halves at once — an unreferenced component is
 * itself dead code, and its links should not vouch for anything.
 */
function reachableFiles() {
  const seen = new Set();
  const queue = [];

  const addEntryPoints = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) addEntryPoints(full);
      else if (/^(page|layout|route|template|error|not-found)\.tsx?$/.test(entry)) {
        queue.push(full);
      }
    }
  };
  addEntryPoints(APP);

  const resolve = (from, spec) => {
    const base = spec.startsWith("@/")
      ? path.join("src", spec.slice(2))
      : path.join(path.dirname(from), spec);
    for (const candidate of [
      `${base}.tsx`, `${base}.ts`,
      path.join(base, "index.tsx"), path.join(base, "index.ts"),
    ]) {
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {
        // Not this extension; try the next.
      }
    }
    return null; // a package, or a .css / .json import
  };

  while (queue.length > 0) {
    const file = path.normalize(queue.pop());
    if (seen.has(file)) continue;
    seen.add(file);

    const code = readFileSync(file, "utf8");
    for (const m of code.matchAll(/from\s+["']([^"']+)["']/g)) {
      if (!m[1].startsWith("@/") && !m[1].startsWith(".")) continue;
      const target = resolve(file, m[1]);
      if (target) queue.push(target);
    }
  }

  return [...seen];
}

/** "/lich/dat-phong/[id]" answers for "/lich/dat-phong/abc" and for "[]". */
const toPattern = (route) =>
  new RegExp(
    "^" + route.replace(/\[[^\]]+\]/g, "(?:[^/]+|\\[\\])").replace(/\//g, "\\/") + "$",
  );

const all = routes();
const patterns = all.map((route) => ({ route, re: toPattern(route) }));

/**
 * Paths, kept next to the file that mentions them.
 *
 * Which file matters, because a link only counts when it comes from *outside*
 * the route it points at. Every action module calls revalidatePath on its own
 * page, so counting those would let each route vouch for itself and no orphan
 * could ever be reported.
 */
const anyPath = []; // [path, file] — blunt
const navigations = new Set(); // precise

for (const file of reachableFiles()) {
  const code = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

  for (const m of code.matchAll(/(["'`])(\/[^"'`?#$\n]*)/g)) anyPath.push([m[2], file]);
  for (const m of code.matchAll(/`(\/[^`\n]*)`/g)) {
    anyPath.push([m[1].replace(/\$\{[^}]*\}/g, "[]").replace(/[?#].*$/, ""), file]);
  }

  for (const m of code.matchAll(/href=(?:"|\{")(\/[^"?#]*)"/g)) navigations.add(m[1]);
  for (const m of code.matchAll(/redirect\(\s*"(\/[^"?#]*)"/g)) navigations.add(m[1]);
}

/** Does this file live inside the route it is naming? */
function isSelfReference(route, file) {
  if (route === "/") return false;
  const wanted = route.slice(1).split("/");
  // Route groups are not part of the URL, so drop them before comparing.
  const parts = path
    .normalize(file)
    .split(path.sep)
    .filter((p) => !(p.startsWith("(") && p.endsWith(")")));
  const after = parts.slice(2); // past "src", "app"
  return wanted.every((segment, i) => after[i] === segment);
}

let failures = 0;

console.log("-- every route has a way in");
const orphans = all.filter((route) => {
  if (ENTRY_POINTS.has(route)) return false;
  const re = toPattern(route);
  return !anyPath.some(([p, file]) => re.test(p) && !isSelfReference(route, file));
});
for (const route of orphans) {
  failures += 1;
  console.log(`FAIL  nothing links to ${route}`);
}
if (orphans.length === 0) console.log(`PASS  ${all.length} routes, all reachable`);

console.log("\n-- every link goes somewhere");
const broken = [...navigations].filter((href) => !patterns.some((p) => p.re.test(href)));
for (const href of broken) {
  failures += 1;
  console.log(`FAIL  ${href} matches no route`);
}
if (broken.length === 0) {
  console.log(`PASS  ${navigations.size} navigations, all real`);
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
