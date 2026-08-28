-- What each organization is paying for.
--
-- An enum, not a row of feature booleans. A plan is a thing a host bought; the
-- features it unlocks are a fact about the plan. Booleans drift out of step
-- with the pricing page the moment either side changes, and the first person
-- to notice is a host who paid for something they did not get.
--
-- planUntil in the past means the subscription lapsed. Limits fall back to
-- FREE and nothing is deleted: a host who forgets a month should not lose a
-- season of bookings, and the data is theirs either way.


-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'CHANNELS', 'PRO');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "plan" "Plan" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "planUntil" TIMESTAMP(3);

