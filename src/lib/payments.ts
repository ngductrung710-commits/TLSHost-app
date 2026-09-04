import "server-only";

import { fill } from "@/lib/i18n";
import { decryptSecret } from "@/lib/secrets";

/**
 * Talking to a host's own Stripe or PayPal account.
 *
 * Raw HTTP rather than either SDK. Both are large dependencies whose main
 * value is convenience around an account you own, and here the credentials
 * belong to a different account on every request — a client constructed
 * per-call is most of what an SDK gives you anyway. Two endpoints each is a
 * small surface to own, and it keeps a host's secret from passing through a
 * library that might log it.
 *
 * Every function returns a result rather than throwing. A payment provider
 * being down must never take a booking with it: the nights are already held,
 * and "pay on arrival" is a normal outcome in Vietnam.
 */

export type Provider = "STRIPE" | "PAYPAL";

export type CheckoutResult =
  | { ok: true; externalId: string; url: string }
  | { ok: false; error: string };

export type VerifyResult =
  | { ok: true; paid: boolean; amount: number | null }
  | { ok: false; error: string };

type Account = {
  provider: Provider;
  publicId: string;
  secretEnc: string;
  live: boolean;
};

const TIMEOUT_MS = 15_000;

/** Fetch with a deadline. A slow provider must not hold a guest's browser open. */
async function call(
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Left as text — an HTML error page from a proxy is still worth logging.
    }
    return { status: res.status, body };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Stripe                                                                      */
/* -------------------------------------------------------------------------- */

const STRIPE_API = "https://api.stripe.com/v1";

/**
 * VND is a zero-decimal currency in Stripe's model.
 *
 * Amounts for most currencies are sent in the smallest unit — cents — but VND
 * has no subunit, so 1.200.000 ₫ is sent as 1200000 and not 120000000. Getting
 * this backwards charges a guest a hundred times the price, which is the kind
 * of bug that ends a business.
 */
const STRIPE_ZERO_DECIMAL = new Set(["VND", "JPY", "KRW", "CLP", "ISK", "VUV"]);

function stripeAmount(amount: number, currency: string): number {
  return STRIPE_ZERO_DECIMAL.has(currency.toUpperCase()) ? amount : amount * 100;
}

async function stripeCheckout(
  account: Account,
  args: {
    amount: number;
    currency: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<CheckoutResult> {
  const secret = decryptSecret(account.secretEnc);
  if (!secret) {
    return { ok: false, error: "Không giải mã được khoá Stripe đã lưu." };
  }

  // Stripe's API is form-encoded, including its nested array syntax.
  const form = new URLSearchParams({
    mode: "payment",
    // The caller puts {CHECKOUT_SESSION_ID} in here for Stripe to substitute.
    // URLSearchParams percent-encodes the braces; Stripe is documented to
    // decode and replace it, but this has NOT been run against a live key —
    // no Stripe account was available. If the placeholder ever came back
    // literal, every guest would return with a session id of
    // "{CHECKOUT_SESSION_ID}" and land on "chưa xác nhận được thanh toán".
    // First thing to check with a real test key.
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": args.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(
      stripeAmount(args.amount, args.currency),
    ),
    "line_items[0][price_data][product_data][name]": args.description,
  });

  try {
    const { status, body } = await call(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const data = body as { id?: string; url?: string; error?: { message?: string } };
    if (status !== 200 || !data.id || !data.url) {
      return {
        ok: false,
        error: data.error?.message ?? fill("Stripe trả về {ma}.", { ma: status }),
      };
    }
    return { ok: true, externalId: data.id, url: data.url };
  } catch {
    return { ok: false, error: "Không kết nối được tới Stripe." };
  }
}

async function stripeVerify(
  account: Account,
  externalId: string,
): Promise<VerifyResult> {
  const secret = decryptSecret(account.secretEnc);
  if (!secret) return { ok: false, error: "Không giải mã được khoá Stripe." };

  try {
    const { status, body } = await call(
      `${STRIPE_API}/checkout/sessions/${encodeURIComponent(externalId)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );

    const data = body as {
      payment_status?: string;
      amount_total?: number;
      currency?: string;
      error?: { message?: string };
    };
    if (status !== 200) {
      return { ok: false, error: data.error?.message ?? fill("Stripe trả về {ma}.", { ma: status }) };
    }

    const currency = (data.currency ?? "vnd").toUpperCase();
    const raw = data.amount_total ?? null;
    return {
      ok: true,
      // "paid" is the only value that means money moved. "unpaid" and
      // "no_payment_required" both mean it did not.
      paid: data.payment_status === "paid",
      amount:
        raw === null
          ? null
          : STRIPE_ZERO_DECIMAL.has(currency)
            ? raw
            : Math.round(raw / 100),
    };
  } catch {
    return { ok: false, error: "Không kết nối được tới Stripe." };
  }
}

/* -------------------------------------------------------------------------- */
/* PayPal                                                                      */
/* -------------------------------------------------------------------------- */

const paypalBase = (live: boolean) =>
  live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

/**
 * PayPal wants an OAuth token before anything else.
 *
 * Fetched per request rather than cached. Tokens last hours, but they are
 * per-host here, and a cache keyed by organization is a cache that can hand
 * one host's token to another if the key is ever got wrong. One extra round
 * trip on a checkout nobody is timing is a cheap way to make that impossible.
 */
async function paypalToken(account: Account): Promise<string | null> {
  const secret = decryptSecret(account.secretEnc);
  if (!secret) return null;

  const basic = Buffer.from(`${account.publicId}:${secret}`).toString("base64");
  try {
    const { status, body } = await call(
      `${paypalBase(account.live)}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      },
    );
    if (status !== 200) return null;
    return (body as { access_token?: string }).access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * PayPal will not take every currency, and VND is one it refuses.
 *
 * This was measured against the sandbox API on 2026-09-04, not read off a
 * page: creating an order with currency_code "VND" comes back 422 with
 * CURRENCY_NOT_SUPPORTED. So does KRW, and so do CNY and MYR — though those
 * two are on PayPal's own published list, which is why the honest thing here
 * is a list of what PayPal documents and a comment saying two of them were
 * refused by the account we tested with.
 *
 * The set matters because the app offers exactly two currencies, VND and USD.
 * One of them cannot be paid with PayPal at all. Without the guard below, a
 * VND host connects PayPal successfully — testCredentials only asks for an
 * OAuth token, which succeeds no matter the currency — sees a green
 * "connected" badge, and then every single guest checkout fails at the moment
 * the guest tries to pay.
 */
const PAYPAL_CURRENCIES = new Set([
  "AUD", "BRL", "CAD", "CNY", "CZK", "DKK", "EUR", "HKD", "HUF", "ILS", "JPY",
  "MYR", "MXN", "TWD", "NZD", "NOK", "PHP", "PLN", "GBP", "RUB", "SGD", "SEK",
  "CHF", "THB", "USD",
]);

/** Whether a host can be paid through PayPal in this currency at all. */
export function paypalSupports(currency: string): boolean {
  return PAYPAL_CURRENCIES.has(currency.toUpperCase());
}

/**
 * The currencies PayPal refuses a fractional amount for.
 *
 * Also measured, and the previous list here was wrong in both directions: it
 * named VND, KRW, CLP, ISK and VUV — none of which PayPal takes at all — and
 * it missed HUF and TWD. Sending "12.50" as JPY, HUF or TWD comes back
 * DECIMALS_NOT_SUPPORTED; "1250" is accepted. Every other supported currency
 * takes both.
 *
 * None of these three are selectable in the app today. The set is kept
 * correct anyway, because the day a fourth currency is added is not the day
 * anybody will re-derive this.
 */
const PAYPAL_NO_DECIMALS = new Set(["JPY", "HUF", "TWD"]);

function paypalAmount(amount: number, currency: string): string {
  return PAYPAL_NO_DECIMALS.has(currency.toUpperCase())
    ? String(amount)
    : amount.toFixed(2);
}

async function paypalCheckout(
  account: Account,
  args: {
    amount: number;
    currency: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<CheckoutResult> {
  // Before the network call, not after: PayPal's own refusal for this comes
  // back as "semantically incorrect, or failed business validation", which
  // tells a host nothing about what to change.
  if (!paypalSupports(args.currency)) {
    return {
      ok: false,
      error: "PayPal không nhận tiền tệ này. Đổi tiền tệ của cơ sở, hoặc dùng Stripe.",
    };
  }

  const token = await paypalToken(account);
  if (!token) {
    return { ok: false, error: "Không xác thực được với PayPal. Kiểm tra lại khoá." };
  }

  try {
    const { status, body } = await call(
      `${paypalBase(account.live)}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              description: args.description.slice(0, 127),
              amount: {
                currency_code: args.currency.toUpperCase(),
                value: paypalAmount(args.amount, args.currency),
              },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                return_url: args.successUrl,
                cancel_url: args.cancelUrl,
                user_action: "PAY_NOW",
              },
            },
          },
        }),
      },
    );

    const data = body as {
      id?: string;
      links?: { rel?: string; href?: string }[];
      message?: string;
    };
    const approve = data.links?.find((l) => l.rel === "payer-action" || l.rel === "approve");
    if (status >= 300 || !data.id || !approve?.href) {
      return { ok: false, error: data.message ?? fill("PayPal trả về {ma}.", { ma: status }) };
    }
    return { ok: true, externalId: data.id, url: approve.href };
  } catch {
    return { ok: false, error: "Không kết nối được tới PayPal." };
  }
}

async function paypalVerify(
  account: Account,
  externalId: string,
): Promise<VerifyResult> {
  const token = await paypalToken(account);
  if (!token) return { ok: false, error: "Không xác thực được với PayPal." };

  try {
    // Capture rather than read. A PayPal order the guest approved is still
    // only an authorisation — the money does not move until it is captured,
    // and an order left uncaptured expires with the host never paid.
    const { status, body } = await call(
      `${paypalBase(account.live)}/v2/checkout/orders/${encodeURIComponent(externalId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const data = body as {
      status?: string;
      purchase_units?: { payments?: { captures?: { amount?: { value?: string } }[] } }[];
      details?: { issue?: string }[];
      message?: string;
    };

    // Already captured is a success, not a failure: it means the guest hit
    // the return URL twice, or a webhook got there first.
    const alreadyDone = data.details?.some(
      (d) => d.issue === "ORDER_ALREADY_CAPTURED",
    );
    if (status >= 300 && !alreadyDone) {
      return { ok: false, error: data.message ?? fill("PayPal trả về {ma}.", { ma: status }) };
    }

    const value =
      data.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value ?? null;

    return {
      ok: true,
      paid: alreadyDone || data.status === "COMPLETED",
      amount: value === null ? null : Math.round(Number(value)),
    };
  } catch {
    return { ok: false, error: "Không kết nối được tới PayPal." };
  }
}

/* -------------------------------------------------------------------------- */
/* The two things the app actually calls                                       */
/* -------------------------------------------------------------------------- */

export function createCheckout(
  account: Account,
  args: {
    amount: number;
    currency: string;
    description: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<CheckoutResult> {
  return account.provider === "STRIPE"
    ? stripeCheckout(account, args)
    : paypalCheckout(account, args);
}

export function verifyPayment(
  account: Account,
  externalId: string,
): Promise<VerifyResult> {
  return account.provider === "STRIPE"
    ? stripeVerify(account, externalId)
    : paypalVerify(account, externalId);
}

/**
 * Confirms a host's credentials work, without charging anyone.
 *
 * Stripe: read the account. PayPal: ask for a token. Both are the cheapest
 * call each API has that fails when the key is wrong, so a host finds out at
 * the moment they paste it rather than when a guest tries to pay.
 */
export async function testCredentials(
  account: Account,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (account.provider === "PAYPAL") {
    const token = await paypalToken(account);
    return token
      ? { ok: true }
      : { ok: false, error: "PayPal từ chối cặp khoá này." };
  }

  const secret = decryptSecret(account.secretEnc);
  if (!secret) return { ok: false, error: "Không giải mã được khoá đã lưu." };

  try {
    const { status, body } = await call(`${STRIPE_API}/balance`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (status === 200) return { ok: true };
    const data = body as { error?: { message?: string } };
    return {
      ok: false,
      error: data.error?.message ?? fill("Stripe từ chối khoá này ({ma}).", { ma: status }),
    };
  } catch {
    return { ok: false, error: "Không kết nối được tới Stripe." };
  }
}

/** Exposed for the check script — the amount conversion is the dangerous part. */
export const __testing = { stripeAmount, paypalAmount, PAYPAL_NO_DECIMALS };
