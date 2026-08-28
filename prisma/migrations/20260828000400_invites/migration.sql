-- Invitations, and the third way a membership row becomes readable.
--
-- Accepting an invitation happens before the person has a session, so neither
-- arm of the existing policy applies: there is no current org (they are not in
-- one yet) and no current user (they are not signed in). Without a third arm
-- the acceptance page could not find the row it exists to act on — the same
-- chicken-and-egg that broke sign-in in the previous migration, arriving from
-- the other direction.
--
-- The arm added below admits a row whose invite token hash matches a value the
-- request has set. That is not a hole: the hash is only computable from the
-- token in the link, the token is 256 bits of CSPRNG output, and matching it
-- exposes exactly the one row the holder was sent. The token is cleared on
-- acceptance, so a link cannot be replayed, and inviteExpiresAt is checked in
-- application code on top.


-- AlterTable
ALTER TABLE "membership" ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "membership_inviteTokenHash_key" ON "membership"("inviteTokenHash");



DROP POLICY "membership_read_own_or_org" ON "membership";

CREATE POLICY "membership_read_own_or_org" ON "membership"
  FOR SELECT
  USING (
    "orgId" = current_setting('app.current_org_id', true)
    OR "userId" = current_setting('app.current_user_id', true)
    OR "inviteTokenHash" = current_setting('app.invite_token_hash', true)
  );

-- Accepting also has to WRITE the row: set joinedAt, clear the token. The
-- existing write policy is org-only, so it needs the same narrow exception.
-- Scoped to UPDATE, and only for the row whose token was presented.
CREATE POLICY "membership_accept_invite" ON "membership"
  FOR UPDATE
  USING ("inviteTokenHash" = current_setting('app.invite_token_hash', true))
  WITH CHECK (true);
