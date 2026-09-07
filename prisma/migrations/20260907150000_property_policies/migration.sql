-- CreateEnum
CREATE TYPE "Allowance" AS ENUM ('ALLOWED', 'ON_REQUEST', 'NOT_ALLOWED');

-- CreateEnum
CREATE TYPE "Suitability" AS ENUM ('SUITABLE', 'NOT_SUITABLE');

-- AlterTable
ALTER TABLE "property" ADD COLUMN     "checkInFrom" TEXT,
ADD COLUMN     "checkOutBy" TEXT,
ADD COLUMN     "childrenPolicy" "Suitability",
ADD COLUMN     "depositNote" TEXT,
ADD COLUMN     "eventsPolicy" "Allowance",
ADD COLUMN     "petsPolicy" "Allowance",
ADD COLUMN     "photographyPolicy" "Allowance",
ADD COLUMN     "quietHoursFrom" TEXT,
ADD COLUMN     "quietHoursTo" TEXT,
ADD COLUMN     "smokingPolicy" "Allowance";

