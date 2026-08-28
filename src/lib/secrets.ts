import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Encryption for provider secrets at rest.
 *
 * Only used for one thing: a host's Stripe secret key or PayPal client secret.
 * Everything else in this database is data about bookings; these are keys that
 * move money, and a leaked backup must not hand them over.
 *
 * AES-256-GCM, so a tampered ciphertext fails to decrypt rather than
 * decrypting to something else. The IV is random per encryption and stored
 * with the result — reusing one across two secrets under the same key is the
 * classic way to lose GCM's guarantees entirely.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // GCM's standard nonce length
const TAG_BYTES = 16;

/**
 * The key, derived from SECRET_KEY.
 *
 * Hashed to 32 bytes rather than requiring a hex string of exactly the right
 * length: a deployment where the operator has to produce a 64-character hex
 * value is a deployment where someone eventually pads a short one.
 */
function key(): Buffer {
  const secret = process.env.SECRET_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SECRET_KEY is missing or shorter than 32 characters — payment credentials cannot be stored safely without it",
    );
  }
  return createHash("sha256").update(secret).digest();
}

/** True when a secret can be stored at all. Checked before offering the form. */
export function secretsConfigured(): boolean {
  const secret = process.env.SECRET_KEY;
  return Boolean(secret && secret.length >= 32);
}

/** "iv.ciphertext.tag", all base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    body.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

/**
 * Returns null rather than throwing on anything malformed.
 *
 * A secret that cannot be decrypted — a rotated SECRET_KEY, a truncated row —
 * should disable payments and say so, not crash the settings page or, worse,
 * a guest's checkout.
 */
export function decryptSecret(stored: string): string | null {
  try {
    const [ivPart, bodyPart, tagPart] = stored.split(".");
    if (!ivPart || !bodyPart || !tagPart) return null;

    const iv = Buffer.from(ivPart, "base64url");
    const body = Buffer.from(bodyPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;

    const decipher = createDecipheriv(ALGORITHM, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * "sk_live_…4f2a" — enough for a host to recognise which key is stored,
 * useless to anyone who reads it.
 */
export function maskSecret(plain: string): string {
  if (plain.length <= 8) return "•".repeat(plain.length);
  return `${plain.slice(0, 7)}…${plain.slice(-4)}`;
}
