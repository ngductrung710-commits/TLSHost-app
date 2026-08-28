import "server-only";

import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing.
 *
 * Argon2id, via @node-rs/argon2 rather than the `argon2` package: the latter
 * builds through node-gyp, which needs a C++ toolchain and fails on a stock
 * Windows machine. This one ships prebuilt binaries.
 *
 * The parameters below are OWASP's current baseline (19 MiB, 2 passes, 1 lane).
 * Memory cost is the one that matters — it is what makes a GPU attack
 * expensive — and 19 MiB per hash is comfortable for a login rate that will
 * never exceed a handful per second on a single VPS.
 */
//
// `algorithm` is the numeric member rather than Algorithm.Argon2id: that enum
// is declared `const enum` in an ambient .d.ts, and isolatedModules — which
// Next requires — forbids reading one as a value. The number is part of the
// Argon2 format, not an implementation detail, and it is echoed back in every
// hash string as `$argon2id$`.
const ARGON2ID = 2;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19_456, // KiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/**
 * Checks a password. Returns false rather than throwing on a malformed hash,
 * so a corrupted row denies access instead of returning a 500 that tells an
 * attacker the account exists.
 */
export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plain, OPTIONS);
  } catch {
    return false;
  }
}

/**
 * A dummy verification, run when no account matched.
 *
 * Without it, a request for an unknown email returns as soon as the lookup
 * misses, while a known email pays for a full Argon2 hash. That timing
 * difference is enough to enumerate which addresses have accounts. Doing the
 * work anyway costs one hash on a path that should be rare.
 */
//
// It has to be a genuinely valid Argon2 hash. An invented-looking string would
// make `verify` throw on the first parse, return in microseconds through the
// catch, and reintroduce exactly the timing gap this exists to close. This one
// was produced by the parameters above and measured at ~42ms to reject, which
// matches the cost of a real miss.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$jQOD+GlBXTjA8m26sy93ZQ$1klR+fqyLmzNA3zbbHQmdG/xecmlhpSfyzsP9wB8/Jw";

export async function burnTimeOnMiss(plain: string): Promise<void> {
  await verifyPassword(DUMMY_HASH, plain);
}

/**
 * The rules shown to a person creating an account.
 *
 * A length floor and nothing else: composition rules ("one capital, one
 * symbol") push people toward `Password1!` and are no longer recommended by
 * NIST. Twelve characters of anything beats eight of theatre.
 */
export const MIN_PASSWORD_LENGTH = 12;

export function passwordProblem(plain: string): string | null {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  }
  return null;
}
