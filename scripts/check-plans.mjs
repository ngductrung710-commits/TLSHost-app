// The plan table here, against the pricing page on the marketing site.
//
//   npm run check:plans
//
// These are two separate repositories that deploy independently, and the only
// thing keeping them honest is that someone remembers. This is instead of
// remembering. A host reads the pricing page, pays, and finds out whether the
// software agrees — so a mismatch is a promise broken, not a typo.
//
// Skipped with a notice, not a failure, when the marketing repo is not beside
// this one: the app must still be checkable on a machine that only has it.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { PLANS, PLAN_ORDER, effectivePlan } from "../.tmp/plans.mjs";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

/* -------------------------------------------------------------------- */
console.log("-- lapsed subscriptions fall back to FREE");

const past = new Date(Date.now() - 86_400_000);
const future = new Date(Date.now() + 86_400_000);

check("paid and current stays put", effectivePlan("PRO", future), "PRO");
check("paid with no end date stays put", effectivePlan("PRO", null), "PRO");
check("lapsed falls back", effectivePlan("PRO", past), "FREE");
check("lapsed CHANNELS falls back", effectivePlan("CHANNELS", past), "FREE");
check("FREE ignores the date entirely", effectivePlan("FREE", past), "FREE");

/* -------------------------------------------------------------------- */
console.log("\n-- limits are ordered, never narrowing as you pay more");

for (let i = 1; i < PLAN_ORDER.length; i++) {
  const lower = PLANS[PLAN_ORDER[i - 1]];
  const higher = PLANS[PLAN_ORDER[i]];
  const label = `${PLAN_ORDER[i]} is not worse than ${PLAN_ORDER[i - 1]}`;

  const priceUp = higher.price >= lower.price;
  const propsUp =
    higher.maxProperties === null ||
    (lower.maxProperties !== null && higher.maxProperties >= lower.maxProperties);
  const featuresUp =
    (!lower.channels || higher.channels) &&
    (!lower.assistant || higher.assistant) &&
    (!lower.team || higher.team);

  const ok = priceUp && propsUp && featuresUp;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
}

/* -------------------------------------------------------------------- */
console.log("\n-- against the marketing site's pricing page");

const marketing = path.resolve("../tlshost/src/i18n/dictionaries/vi.ts");

if (!existsSync(marketing)) {
  console.log(
    "SKIP  marketing repo not found beside this one — cannot cross-check prices",
  );
} else {
  const vi = readFileSync(marketing, "utf8");
  const block = vi.slice(vi.indexOf("  pricingPage: {"), vi.indexOf("  included: {"));

  // The page writes prices as human strings: "₫0", "₫290k", "₫690k".
  const prices = [...block.matchAll(/price:\s*"₫([^"]+)"/g)].map((m) => m[1]);
  const names = [...block.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]);

  const asDong = (s) =>
    s.endsWith("k") ? Number(s.slice(0, -1)) * 1000 : Number(s);

  check(
    "three plans on both sides",
    [names.length, prices.length],
    [PLAN_ORDER.length, PLAN_ORDER.length],
  );

  PLAN_ORDER.forEach((plan, i) => {
    check(`${plan} name matches the page`, PLANS[plan].name, names[i]);
    check(`${plan} price matches the page`, PLANS[plan].price, asDong(prices[i]));
  });

  // The features the page advertises, and the flag each one implies here.
  const claims = [
    ["Đồng bộ iCal hai chiều", "CHANNELS", "channels"],
    ["Không giới hạn số chỗ nghỉ", "CHANNELS", "unlimited"],
    ["Trợ lý AI vận hành", "PRO", "assistant"],
    ["Thành viên và phân quyền theo phạm vi", "PRO", "team"],
  ];

  for (const [text, plan, flag] of claims) {
    const advertised = block.includes(text);
    const implemented =
      flag === "unlimited" ? PLANS[plan].maxProperties === null : PLANS[plan][flag];
    const ok = advertised === implemented;
    if (!ok) failures += 1;
    console.log(
      `${ok ? "PASS" : "FAIL"}  "${text}" — page says ${advertised}, ${plan} gives ${implemented}`,
    );
  }

  // The free plan promises one property in as many words.
  const oneProperty = block.includes('"Một chỗ nghỉ"');
  const ok = oneProperty && PLANS.FREE.maxProperties === 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  free plan's one-property promise matches`);
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
