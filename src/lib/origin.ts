import "server-only";

import { headers } from "next/headers";

/**
 * The public base URL of this request, for building links that leave the app.
 *
 * Read from the request rather than from configuration, because the same
 * build serves localhost, a staging host and the real domain, and a link that
 * carries the wrong one is a link that lands nowhere — a guest returning from
 * a payment provider, or a host clicking a reset link in their mail.
 *
 * `x-forwarded-proto` because Nginx terminates TLS and talks to Node over
 * plain HTTP: without it every generated link on the production server would
 * say http://, and every browser that follows one would be one redirect away
 * from sending a reset token in clear.
 */
export async function origin(): Promise<string> {
  const head = await headers();
  const host = head.get("host") ?? "localhost:3001";
  const proto =
    head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
