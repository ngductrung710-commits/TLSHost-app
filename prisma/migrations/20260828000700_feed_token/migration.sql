-- Lets the public availability feed find its own room.
--
-- The third time row-level security has caught this codebase at the same
-- boundary, and the pattern is worth naming: every place where identity comes
-- from a token in a URL rather than from a session needs its own narrow SELECT
-- arm, because the policies are written around an org that nothing has
-- established yet.
--
--   sign-in       reads `membership` to find the org      → app.current_user_id
--   invitations   read `membership` before joining one    → app.invite_token_hash
--   feeds         read `room` with no account at all      → app.ical_token
--
-- Each is one table, SELECT only, matched on a value the caller must already
-- hold. None of them widens what an ordinary signed-in request can see.
--
-- The feed route uses this to learn the room's organization, then does
-- everything else through withOrg like the rest of the app.

CREATE POLICY "room_read_by_feed_token" ON "room"
  FOR SELECT
  USING ("icalToken" = current_setting('app.ical_token', true));
