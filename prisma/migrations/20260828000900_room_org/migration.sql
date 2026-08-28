-- Rooms carry their own orgId, and the recursive policy pair goes away.
--
-- The previous migration added a feed-token arm to `property` so the export
-- route could read a room's organization. That made the two policies mutually
-- recursive — `room` asked `property`, `property` asked `room` — and Postgres
-- refused the whole query with 42P17.
--
-- The recursion was a symptom. Room was the only tenant table that could not
-- say which organization it belonged to without a join, so its policy had to
-- perform one, and the moment anything joined back the pair closed a loop.
-- Giving it the column every sibling table already has removes the join, the
-- loop, and the extra policy together.

DROP POLICY "property_read_by_feed_token" ON "property";

ALTER TABLE "room" ADD COLUMN "orgId" TEXT;

-- Backfill before the column can be required. Every existing room reaches its
-- org through exactly one property, so this is unambiguous.
UPDATE "room" r
SET "orgId" = p."orgId"
FROM "property" p
WHERE p."id" = r."propertyId";

ALTER TABLE "room" ALTER COLUMN "orgId" SET NOT NULL;

ALTER TABLE "room"
  ADD CONSTRAINT "room_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "room_orgId_idx" ON "room"("orgId");

-- Direct now, matching every other table. The EXISTS form it replaces was
-- correct but only by borrowing property's policy, which is what made it
-- fragile.
DROP POLICY "room_org_isolation" ON "room";

CREATE POLICY "room_org_isolation" ON "room"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- The feed-token arm stays: it is what lets a request with no session find the
-- one room whose token it holds, and it no longer touches another table.
