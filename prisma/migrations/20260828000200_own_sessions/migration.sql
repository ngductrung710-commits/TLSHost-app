-- Sessions become ours rather than Auth.js's.
--
-- @auth/core's credentials path always issues a JWT cookie and never writes to
-- the adapter's session table, whatever session strategy is configured, so the
-- Auth.js-shaped columns here were never going to be filled. Immediate
-- revocation is a real requirement — removing a collaborator has to end their
-- access on the next request — so the table stays and the library goes.
--
-- Safe as a destructive change because nothing has signed in yet: the column
-- being dropped has never held a row.


-- DropIndex
DROP INDEX "session_sessionToken_key";

-- AlterTable
ALTER TABLE "session" DROP COLUMN "expires",
DROP COLUMN "sessionToken",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "expiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "tokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "session_tokenHash_key" ON "session"("tokenHash");

