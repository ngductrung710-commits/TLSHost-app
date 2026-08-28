import "server-only";

import { cookies } from "next/headers";

/**
 * The workspace's light/dark setting.
 *
 * A cookie rather than a column, because this is a property of the device
 * rather than of the business: a host on a phone at night and a manager on a
 * desktop at noon want different answers, and they share one organization.
 *
 * Read on the server so the first paint is already correct. The usual
 * localStorage approach flashes the wrong theme on every navigation, which on
 * a dark setting is a white rectangle in a dark room.
 */

export type Appearance = "light" | "dark" | "system";

const COOKIE = "tlshost_theme";

export async function readAppearance(): Promise<Appearance> {
  const value = (await cookies()).get(COOKIE)?.value;
  return value === "light" || value === "dark" ? value : "system";
}

export async function writeAppearance(value: Appearance): Promise<void> {
  const jar = await cookies();
  if (value === "system") {
    jar.delete(COOKIE);
    return;
  }
  jar.set(COOKIE, value, {
    // Not httpOnly: no secret, and a client-side toggle may want to read it.
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
