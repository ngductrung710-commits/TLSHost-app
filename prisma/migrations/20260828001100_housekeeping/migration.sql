-- Housekeeping state, without a scheduled job.
--
-- The obvious design stores "dirty" and has something flip it when a guest
-- checks out. That needs a job that runs every night in every timezone, and
-- the failure mode when it does not run is a room that looks clean and is not.
--
-- Instead only two things are stored: what a person last said about the room,
-- and when it was last cleaned. "Needs cleaning" is then a comparison — has
-- anyone checked out since cleanedAt — which is answered from data already
-- present, is right the moment anyone looks, and cannot drift because there is
-- nothing to drift out of sync with.
--
-- MAINTENANCE is the exception and is genuinely stored: a room held out of
-- service does not become available again because someone tidied it.


-- CreateEnum
CREATE TYPE "CleanState" AS ENUM ('CLEAN', 'DIRTY', 'INSPECTED', 'MAINTENANCE');

-- AlterTable
ALTER TABLE "room" ADD COLUMN     "cleanState" "CleanState" NOT NULL DEFAULT 'CLEAN',
ADD COLUMN     "cleanedAt" TIMESTAMP(3),
ADD COLUMN     "cleanedByMembershipId" TEXT;

