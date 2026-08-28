-- The feed needs the room's organization, and a room does not carry one.
--
-- `room` has only propertyId; the org lives on `property`, which is under its
-- own policy. So the previous migration let the feed find the room and then
-- handed it a null property, because the join was filtered out underneath it.
--
-- This arm admits exactly the property that owns a room bearing the presented
-- token. SELECT only, and no wider than the room arm it mirrors: whoever holds
-- the token can already see that room.
--
-- Worth noting for whoever adds the next token-scoped route: a narrow arm on
-- the table you query is not enough. Every table the query traverses needs one,
-- because each is filtered independently and a filtered-out join comes back as
-- null rather than as an error.

CREATE POLICY "property_read_by_feed_token" ON "property"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "room" r
      WHERE r."propertyId" = "property"."id"
        AND r."icalToken" = current_setting('app.ical_token', true)
    )
  );
