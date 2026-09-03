import { prisma } from "@/lib/db";

/**
 * Is this thing actually working?
 *
 * Meant for an uptime monitor to poll every minute or two. The point is that
 * it answers a harder question than "is Next serving HTML" — a monitor
 * pointed at the sign-in page gets a cheerful 200 while Postgres is down, the
 * calendar is empty for every host, and no booking can be saved. The web
 * server is the part least likely to fail silently; the database is the part
 * most likely to.
 *
 * So this touches the database, and returns 503 when it cannot.
 *
 * The body says almost nothing on purpose. It is a public URL — anyone can
 * poll it, and a health endpoint that reports which dependency failed, with
 * what error, is a reconnaissance endpoint. "ok" or "down" is all a monitor
 * needs, and all a stranger gets.
 */

/** Never cached, never prerendered: a cached health check is a lie with a TTL. */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Give up rather than hang.
 *
 * A monitor that waits forever reports nothing, and every hung request holds a
 * connection from a pool that the real traffic needs. Postgres refusing
 * connections fails fast; Postgres accepting them and then not answering is
 * the case this exists for, and it is the worse of the two.
 */
const TIMEOUT_MS = 3000;

export async function GET(): Promise<Response> {
  const started = Date.now();

  const headers = {
    "content-type": "application/json; charset=utf-8",
    // Belt and braces alongside `dynamic`: some proxies cache on their own
    // reading of the headers rather than on what Next says.
    "cache-control": "no-store, no-cache, must-revalidate",
  };

  try {
    // The cheapest query that proves a round trip: no table, no planner work,
    // no row locks. Anything reading a real table would also fail when that
    // one table is missing, which is a different question from "is the
    // database there".
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
      ),
    ]);
  } catch {
    // Deliberately swallowed. What went wrong belongs in the server log, which
    // PM2 keeps; what reaches the internet is one word.
    return new Response(JSON.stringify({ status: "down" }), {
      status: 503,
      headers,
    });
  }

  return new Response(
    JSON.stringify({ status: "ok", ms: Date.now() - started }),
    { status: 200, headers },
  );
}
