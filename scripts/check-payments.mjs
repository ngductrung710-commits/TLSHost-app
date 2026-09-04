// Money: currency conversion, and the encryption around a host's provider keys.
//
//   npm run check:payments
//
// Two things here can go wrong quietly and expensively.
//
// The first is the exponent. Stripe takes the smallest unit of the currency,
// which for USD is cents and for VND is the đồng itself — VND has no minor
// unit. Multiplying by 100 anyway turns 1 200 000 ₫ into 120 000 000 ₫, and
// the guest's card is charged a hundred times the room rate. Nothing in the
// type system stops that; the numbers stay plausible either way.
//
// The second is the encryption of a host's secret key. AES-GCM either refuses
// tampered input or it is not doing its job, and "it round-trips" is the half
// of that which is easy to get right.
//
// The live provider calls are NOT covered. Reaching Stripe and PayPal needs
// real credentials, which do not exist in this repository and must not.

process.env.SECRET_KEY ??= "check-payments-key-that-is-long-enough-32+";

const {
  __testing: { stripeAmount, paypalAmount, PAYPAL_NO_DECIMALS },
  paypalSupports,
  formatMoney,
  formatPlanPrice,
  decryptSecret,
  encryptSecret,
  maskSecret,
  secretsConfigured,
} = await import("../.tmp/payments.mjs");

let failures = 0;
const check = (label, got, want) => {
  const ok = Object.is(got, want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

/* -------------------------------------------------------------------- */
console.log("-- Stripe: zero-decimal currencies are not multiplied");

// The one that matters. A three-night stay at 400 000 ₫.
check("VND passes through untouched", stripeAmount(1_200_000, "VND"), 1_200_000);
check("vnd, lowercase, same", stripeAmount(1_200_000, "vnd"), 1_200_000);
check("JPY passes through", stripeAmount(15_000, "JPY"), 15_000);
check("KRW passes through", stripeAmount(90_000, "KRW"), 90_000);

console.log("\n-- Stripe: everything else is in minor units");
check("USD becomes cents", stripeAmount(120, "USD"), 12_000);
check("usd, lowercase, same", stripeAmount(120, "usd"), 12_000);
check("EUR becomes cents", stripeAmount(85, "EUR"), 8_500);
check("zero stays zero", stripeAmount(0, "USD"), 0);

console.log("\n-- PayPal: strings, with the right number of decimals");
// This list used to say VND, KRW, CLP, ISK and VUV, and it was wrong about
// every one of them: PayPal does not accept any of those currencies at all,
// so how many decimals to write for them was never a real question. It also
// omitted HUF and TWD, which are real. Corrected on 2026-09-04 by asking the
// sandbox API: "12.50" as JPY, HUF or TWD comes back DECIMALS_NOT_SUPPORTED,
// while "1250" is accepted.
check("JPY has none", paypalAmount(15_000, "JPY"), "15000");
check("HUF has none", paypalAmount(15_000, "HUF"), "15000");
check("TWD has none", paypalAmount(15_000, "TWD"), "15000");
check("USD has two", paypalAmount(120, "USD"), "120.00");
check("usd, lowercase, same", paypalAmount(120, "usd"), "120.00");
check("EUR has two", paypalAmount(85.5, "EUR"), "85.50");
// Joined, because check() compares with Object.is and two arrays holding the
// same strings are still two arrays.
check(
  "the no-decimals set is exactly those three",
  [...PAYPAL_NO_DECIMALS].sort().join(" "),
  "HUF JPY TWD",
);

console.log("\n-- PayPal: currencies it will not take");
// The guard that matters. VND is this product's default currency and
// PayPal refuses it outright — measured against the sandbox API, 422 with
// CURRENCY_NOT_SUPPORTED — so a host on VND has to be told before a guest
// discovers it at the moment they try to pay.
check("VND is refused", paypalSupports("VND"), false);
check("KRW is refused", paypalSupports("KRW"), false);
check("USD is fine", paypalSupports("USD"), true);
check("lowercase is fine too", paypalSupports("usd"), true);
check("nonsense is refused", paypalSupports("XXX"), false);

/* -------------------------------------------------------------------- */
console.log("\n-- money on screen: the right symbol, on the right side");

// This is here because it broke silently. Every screen formatted money with
// a hardcoded ₫, which nobody could see while every organization priced in
// đồng — and the moment one switched to dollars, a seventy-six dollar room
// rendered as "76 ₫". The number was right and the price was nonsense.
check("VND groups with stops and trails the symbol", formatMoney(1_400_000, "VND", "vi"), "1.400.000 ₫");
check("…and with commas for an English reader", formatMoney(1_400_000, "VND", "en"), "1,400,000 ₫");
check("USD leads with the symbol", formatMoney(76, "USD", "vi"), "$76");
check("…in either language", formatMoney(1234, "USD", "en"), "$1,234");
check("zero is still a price", formatMoney(0, "USD", "vi"), "$0");
// An unknown code prints the code rather than guessing a symbol: wrong
// money is worse than unfamiliar money.
check("an unknown currency shows its code", formatMoney(50, "XYZ", "vi"), "50 XYZ");

// Our own plan prices do not follow the host's currency. A host who prices
// rooms in dollars still pays us in đồng, by Vietnamese bank transfer.
check("a plan price stays in dong", formatPlanPrice(690_000, "vi"), "690.000 ₫");
check("…even for an English reader", formatPlanPrice(690_000, "en"), "690,000 ₫");

/* -------------------------------------------------------------------- */
console.log("\n-- provider secrets survive a round trip");

const secret = "not-a-real-key-only-round-trip-material";
const stored = encryptSecret(secret);

check("configured with a long enough key", secretsConfigured(), true);
check("decrypts back to the original", decryptSecret(stored), secret);
check("the plaintext is not in the stored value", stored.includes("round-trip"), false);

// Same input, encrypted twice, must not produce the same bytes — a fixed IV
// under one key is how GCM stops protecting anything.
check("two encryptions differ", encryptSecret(secret) === encryptSecret(secret), false);

console.log("\n-- and are refused when altered");

const [iv, body, tag] = stored.split(".");
const flip = (b64) => {
  const buf = Buffer.from(b64, "base64url");
  buf[0] ^= 0x01;
  return buf.toString("base64url");
};

check("a flipped ciphertext bit is refused", decryptSecret(`${iv}.${flip(body)}.${tag}`), null);
check("a flipped tag bit is refused", decryptSecret(`${iv}.${body}.${flip(tag)}`), null);
check("a flipped IV bit is refused", decryptSecret(`${flip(iv)}.${body}.${tag}`), null);
check("a truncated value is refused", decryptSecret(`${iv}.${body}`), null);
check("an empty value is refused", decryptSecret(""), null);
check("garbage is refused", decryptSecret("not-even-close"), null);

// A rotated SECRET_KEY must disable payments, not crash a guest's checkout.
const original = process.env.SECRET_KEY;
process.env.SECRET_KEY = "a-completely-different-key-also-32-chars";
check("a rotated key returns null rather than throwing", decryptSecret(stored), null);
process.env.SECRET_KEY = original;

console.log("\n-- masking shows enough to recognise, not enough to use");
check("keeps the prefix and last four", maskSecret(secret), "not-a-r…rial");
check("short values are hidden entirely", maskSecret("abc"), "•••");
check("the middle is gone", maskSecret(secret).includes("round-trip"), false);

/* -------------------------------------------------------------------- */
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
