import { buildIcal } from "@/lib/ical";
import { withFeedToken, withOrg } from "@/lib/db";

/**
 * The public availability feed for one room.
 *
 * Deliberately outside the (app) group and outside any session: this URL is
 * handed to Airbnb, Booking.com and anyone who learns it, and those fetchers
 * have no account here. The token in the path is the whole credential, which is
 * why it is 256 bits and why a room has no feed until a host asks for one.
 *
 * It says only which nights are gone. No guest names, no prices, no contact
 * details — everything an OTA needs and nothing it is owed.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/feed/[token]">,
) {
  const { token } = await ctx.params;

  // Two steps, because there is no session here to derive an organization from.
  // The token buys exactly one thing: finding the room it belongs to, through a
  // policy arm that matches on the token itself. A wrong token finds nothing —
  // the same answer as a room that does not exist, which is the answer to give.
  const found = await withFeedToken(token, (tx) =>
    tx.room.findFirst({
      where: { icalToken: token },
      // orgId comes off the room directly. Reading it through `property` meant
      // the join had to pass property's own policy, which no feed request can
      // — and the arm added to let it through made the two policies mutually
      // recursive. The room's own column has no such problem.
      select: { id: true, name: true, orgId: true },
    }),
  );

  if (!found) {
    return new Response("Not found", { status: 404 });
  }

  // Everything else goes through the ordinary org path, now that the room has
  // said which org that is.
  const room = await withOrg(found.orgId, async (tx) => {
    const property = await tx.property.findFirst({
      where: { rooms: { some: { id: found.id } } },
      select: { name: true },
    });
    const bookings = await tx.booking.findMany({
      where: { roomId: found.id, status: { not: "CANCELLED" } },
      select: { id: true, checkIn: true, checkOut: true },
    });
    const blocks = await tx.block.findMany({
      where: { roomId: found.id },
      select: { id: true, dateFrom: true, dateTo: true, reason: true },
    });
    return { ...found, propertyName: property?.name ?? "", bookings, blocks };
  });

  const body = buildIcal({
    name: `${room.propertyName} — ${room.name}`,
    events: [
      ...room.bookings.map((b) => ({
        uid: `booking-${b.id}@tlshost.vn`,
        start: b.checkIn,
        end: b.checkOut,
        summary: "Đã đặt",
      })),
      // Blocks that came from a channel are echoed back too. An OTA that reads
      // its own reservation returning is harmless — it matches on UID, and ours
      // differs — while omitting them would tell every other channel the room
      // is free on nights it is not.
      ...room.blocks.map((b) => ({
        uid: `block-${b.id}@tlshost.vn`,
        start: b.dateFrom,
        end: b.dateTo,
        summary: b.reason === "CHANNEL_SYNC" ? "Đã đặt" : "Không nhận khách",
      })),
    ],
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // OTAs poll this on their own schedule; a cached copy would hand them
      // availability that is minutes or hours stale, which is the one thing
      // this URL must never do.
      "Cache-Control": "no-store, max-age=0",
      "Content-Disposition": 'inline; filename="availability.ics"',
      // Nothing about this response should be indexed or embedded.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
