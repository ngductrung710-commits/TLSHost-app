-- How a host's guest-facing page looks.
--
-- Four presets rather than free-form styling. A host choosing a look should
-- not be able to produce a page nobody can read, and four options whose text
-- contrast was checked are worth more than infinite ones that were not. The
-- brand colour is the one free choice, and it is checked against the chosen
-- preset's background before it is saved.
--
-- logoFile holds a filename, never a path. The upload action names the file
-- itself, so nothing a host types can escape the uploads directory.


-- CreateEnum
CREATE TYPE "BookingTheme" AS ENUM ('CLASSIC', 'MINIMAL', 'WARM', 'BOLD');

-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "bookingTheme" "BookingTheme" NOT NULL DEFAULT 'CLASSIC',
ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "logoFile" TEXT;

