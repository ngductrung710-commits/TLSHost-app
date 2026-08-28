import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Opaque tokens for sessions and invitations.
 *
 * Lives in its own module because both a "use server" action file and a page
 * need `hashToken`, and a "use server" file may only export async functions —
 * re-exporting it from there is a build error, not a style preference.
 *
 * Only ever the hash is stored. A leaked database backup then contains no live
 * session and no usable invitation, and nothing in the app needs the original
 * value back: it arrives with the request, from a cookie or a URL.
 *
 * SHA-256 with no salt is correct here, unlike for passwords. The input is 256
 * bits of CSPRNG output, so there is no dictionary to precompute and nothing a
 * slow KDF would buy.
 */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
