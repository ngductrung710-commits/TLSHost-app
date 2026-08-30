-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOTEL', 'BOUTIQUE_HOTEL', 'HOMESTAY', 'VILLA', 'APARTMENT', 'GUESTHOUSE', 'RESORT', 'HOSTEL');

-- AlterTable
ALTER TABLE "property" ADD COLUMN     "type" "PropertyType";
