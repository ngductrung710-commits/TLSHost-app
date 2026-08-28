-- The guest-facing booking page.
--
-- Fourth entry point that identifies itself with something other than a
-- session, and the policy arms below follow the shape the previous three
-- settled into: one narrow SELECT per table the request has to traverse,
-- matched on a value the caller must already hold.
--
-- Unlike the feed token, a slug is not a secret — the whole point is to put it
-- in a bio or a message. What guards this page is `published`, not secrecy, so
-- every arm below tests it. A host who has not published cannot be booked
-- through a guessed URL.
--
-- `room` needs an arm as well as `property`: a filtered-out join comes back as
-- null rather than as an error, which cost an afternoon on the feed route.
-- `room` carries orgId directly now, so neither arm joins back to the other
-- and the pair cannot recurse.


-- AlterTable
ALTER TABLE "property" ADD COLUMN     "intro" TEXT,
ADD COLUMN     "publicSlug" TEXT,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "property_publicSlug_key" ON "property"("publicSlug");



CREATE POLICY "property_read_published" ON "property"
  FOR SELECT
  USING (
    "published" = true
    AND "publicSlug" = current_setting('app.public_slug', true)
  );

CREATE POLICY "room_read_published" ON "room"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "property" p
      WHERE p."id" = "room"."propertyId"
        AND p."published" = true
        AND p."publicSlug" = current_setting('app.public_slug', true)
    )
  );
