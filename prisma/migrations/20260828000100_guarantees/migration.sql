-- ============================================================================
-- The two guarantees Prisma's schema language cannot express.
--
-- Everything in the previous migration is shape. This one is behaviour, and
-- it is the reason the calendar is worth building before anything else:
--
--   1. A room cannot hold two overlapping stays. Not "should not" — cannot.
--   2. One organization cannot read another's rows, even if application code
--      forgets the filter.
--
-- Both are enforced by Postgres, below the application, so a bug in a route
-- handler or a future AI-generated query cannot get around them.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. No double booking
--
-- Checking availability in application code always has a hole: two requests
-- read "free" at the same moment and both write. The window is small and it
-- will be hit, because the times a room is nearly full are exactly the times
-- two people try to book it at once.
--
-- An exclusion constraint closes it. Postgres refuses the second write itself,
-- so there is no window to lose.
--
-- btree_gist is what lets an exclusion constraint mix an equality test on a
-- scalar (room_id) with an overlap test on a range. GiST alone cannot compare
-- text for equality.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- '[)' is the half-open range: check_in included, check_out excluded. A guest
-- leaving on the 15th and one arriving on the 15th do not overlap, which is
-- the whole point — the alternative is refusing perfectly good back-to-back
-- bookings, and hosts notice that fast.
--
-- The WHERE clause keeps cancelled bookings out of the constraint, so a
-- cancellation frees its nights while the row survives as a record.
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE ("status" <> 'CANCELLED');

ALTER TABLE "block"
  ADD CONSTRAINT "block_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("dateFrom", "dateTo", '[)') WITH &&
  );

-- A block and a booking on the same night are also a conflict, but no single
-- constraint can span two tables. Both are checked in one transaction by
-- assertNightsFree() in src/lib/availability.ts, which takes a row lock on the
-- room first so the check cannot race. The two constraints above still catch
-- same-table collisions with no help from the application.

-- Empty and backwards ranges would slip past an overlap test, since a range
-- that contains nothing overlaps nothing. Reject them at the source.
ALTER TABLE "booking"
  ADD CONSTRAINT "booking_dates_ordered" CHECK ("checkOut" > "checkIn");

ALTER TABLE "block"
  ADD CONSTRAINT "block_dates_ordered" CHECK ("dateTo" > "dateFrom");


-- ---------------------------------------------------------------------------
-- 2. Tenant isolation
--
-- A forgotten orgId filter shows one customer another customer's guests. It
-- is the worst thing this product can do, so it gets two independent layers:
-- a Prisma client extension that injects the filter, and this — row-level
-- security, which holds even when the first layer is bypassed.
--
-- The application sets app.current_org_id at the start of every transaction.
-- current_setting(..., true) returns NULL rather than raising when it was
-- never set, and NULL = anything is NULL, so an unset variable yields zero
-- rows. Failing closed is the point: a query that forgets to identify itself
-- sees nothing, instead of seeing everything.
-- ---------------------------------------------------------------------------

ALTER TABLE "property"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "booking"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "block"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership"      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "property_org_isolation" ON "property"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

CREATE POLICY "booking_org_isolation" ON "booking"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

CREATE POLICY "block_org_isolation" ON "block"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

CREATE POLICY "membership_org_isolation" ON "membership"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

-- room and membership_scope carry no orgId of their own; they reach it through
-- a parent that is already protected above. Written as EXISTS against that
-- parent so there is one definition of "my org", not two that can drift.
ALTER TABLE "room"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_scope" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_org_isolation" ON "room"
  USING (EXISTS (SELECT 1 FROM "property" p WHERE p."id" = "room"."propertyId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "property" p WHERE p."id" = "room"."propertyId"));

CREATE POLICY "membership_scope_org_isolation" ON "membership_scope"
  USING (EXISTS (SELECT 1 FROM "property" p WHERE p."id" = "membership_scope"."propertyId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "property" p WHERE p."id" = "membership_scope"."propertyId"));

-- "user" and "session" are deliberately NOT protected this way. A user may
-- belong to several organizations, so scoping them to one would break sign-in
-- before an org is even chosen. Access to those two is guarded by the session
-- itself, not by tenancy.

-- One warning worth leaving in the file: RLS does not apply to a table's owner
-- or to any superuser unless FORCE is set. The local dev role is usually the
-- owner, which means these policies are silently inactive there. Run
-- `npm run db:verify` to test them under a role where they do apply, and give
-- the application its own non-owner role in production.
