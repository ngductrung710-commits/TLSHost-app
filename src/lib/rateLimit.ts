import "server-only";

import { headers } from "next/headers";

/**
 * How many times something may fail before it has to wait.
 *
 * Built for the sign-in form, which is the one public endpoint where guessing
 * repeatedly is the whole attack. `burnTimeOnMiss()` already makes a wrong
 * email and a wrong password take the same time, so an attacker learns nothing
 * from one attempt — but nothing stopped them from making ten thousand.
 *
 * In memory, not in the database.
 *
 * A counter in Postgres would mean a write on every failed attempt, which
 * hands an attacker a way to fill the disk by getting the password wrong. It
 * would also outlive a restart, which sounds like a feature until you are the
 * host locked out at 11pm by someone else's botnet and the only way back in is
 * a database query.
 *
 * The cost is that a restart clears every counter. That is acceptable here
 * because an attacker cannot cause a restart — and because PM2 runs this as a
 * single process (see DEPLOY.md); under `pm2 -i max` each worker would keep its
 * own counters and the effective limit would multiply by the worker count.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Drop expired buckets whenever the map grows.
 *
 * Without this, every distinct email an attacker tries is a Map entry that
 * lives forever — a slow memory leak driven by exactly the traffic this file
 * exists to survive. Sweeping on write costs nothing at normal volumes and
 * bounds the map by the number of *recent* keys rather than all keys ever.
 */
function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Count one attempt against `key`, and say whether it is allowed.
 *
 * A fixed window, not a sliding one: simpler, and the difference only matters
 * to an attacker timing their bursts against the boundary — which buys them
 * one extra window's worth of guesses and nothing more.
 */
export function hit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true };
}

/** Forget a key — called after a success, so one good login clears the count. */
export function clear(key: string): void {
  buckets.delete(key);
}

/** Only for tests: start from nothing. */
export function reset(): void {
  buckets.clear();
}

/** Only for tests: how many buckets are being held. */
export function bucketCount(): number {
  return buckets.size;
}

/**
 * Pick the client's address out of the proxy headers.
 *
 * Split from clientIp() so it can be tested. The whole risk in this file lives
 * in these six lines, and a function that can only run inside a request is a
 * function nothing checks.
 *
 * Nginx is configured with `proxy_set_header X-Forwarded-For
 * $proxy_add_x_forwarded_for`, which **appends** the connecting address to
 * whatever the client already sent. A request arriving with a forged
 * `X-Forwarded-For: 1.2.3.4` reaches the application as `1.2.3.4, <real ip>`.
 *
 * So the last entry is the one our own proxy wrote, and every entry before it
 * is attacker-controlled text.
 *
 * This is the trap: most examples take the *first* entry, which is right when
 * you trust the whole chain and exactly wrong here. Taking the first would let
 * an attacker send a different fake address on every request and never reach a
 * limit — a rate limiter that reads as protection and is not.
 */
export function pickClientIp(
  forwardedFor: string | null,
  realIp: string | null,
): string | null {
  if (forwardedFor) {
    const hops = forwardedFor.split(",").map((h) => h.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }
  // Some proxies set this instead, and it holds a single address rather than a
  // chain, so there is nothing to pick apart.
  return realIp;
}

/**
 * The client's address for this request, or null when no proxy header is set.
 *
 * Null rather than a placeholder, so a caller decides what to do rather than
 * having every local request quietly share one bucket.
 */
export async function clientIp(): Promise<string | null> {
  const head = await headers();
  return pickClientIp(head.get("x-forwarded-for"), head.get("x-real-ip"));
}
