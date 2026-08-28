-- Lets a signed-in user find out which organization they belong to.
--
-- The previous policy on `membership` was keyed on app.current_org_id alone,
-- which made the table unreadable to the one query that needs it most: the
-- lookup that *determines* the org from a session. It could not set the org
-- first, because finding the org is what it was for. So sign-in succeeded,
-- wrote its session, and then bounced straight back to the sign-in page.
--
-- The fix is a second session variable. A request may read a membership row if
-- either:
--   - it has already established an org and the row belongs to it (every
--     ordinary query, unchanged), or
--   - the row belongs to the user the session says is asking.
--
-- The second arm is not a hole. app.current_user_id is set from a session
-- token the server looked up itself, never from anything the client sends, and
-- it only ever exposes that user's own memberships — the rows they would
-- otherwise be unable to discover they had.
--
-- WITH CHECK deliberately stays org-only: reading your own membership is how
-- you get in, but writing one is administration, and administration always
-- happens inside an established org.

DROP POLICY "membership_org_isolation" ON "membership";

CREATE POLICY "membership_read_own_or_org" ON "membership"
  FOR SELECT
  USING (
    "orgId" = current_setting('app.current_org_id', true)
    OR "userId" = current_setting('app.current_user_id', true)
  );

CREATE POLICY "membership_write_in_org" ON "membership"
  FOR ALL
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
