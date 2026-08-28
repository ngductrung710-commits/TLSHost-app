-- Channels: two-way iCal, and the audit trail for it.
--
-- Imported availability lands in `block`, not `booking`. An OTA's iCal feed
-- carries dates and an opaque UID and nothing else — no guest name that can be
-- relied on, no price, no channel reference. Writing that into `booking` would
-- mean a table of guests who are mostly called "Reserved", and every revenue
-- number computed from it would be wrong. A block says exactly what is known:
-- these nights are gone.
--
-- The (channelId, externalUid) pair is unique so a re-sync updates the row it
-- already made instead of stacking another copy of the same reservation every
-- hour.


-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'OK', 'FAILED', 'HELD');

-- AlterTable
ALTER TABLE "block" ADD COLUMN     "channelId" TEXT,
ADD COLUMN     "externalUid" TEXT;

-- AlterTable
ALTER TABLE "room" ADD COLUMN     "icalToken" TEXT;

-- CreateTable
CREATE TABLE "channel" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "kind" "BookingSource" NOT NULL,
    "importUrl" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncOk" BOOLEAN,
    "heldDeletions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_run" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "eventsSeen" INTEGER NOT NULL DEFAULT 0,
    "eventsApplied" INTEGER NOT NULL DEFAULT 0,
    "eventsRemoved" INTEGER NOT NULL DEFAULT 0,
    "heldDeletions" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_orgId_idx" ON "channel"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_roomId_kind_key" ON "channel"("roomId", "kind");

-- CreateIndex
CREATE INDEX "sync_run_channelId_startedAt_idx" ON "sync_run"("channelId", "startedAt");

-- CreateIndex
CREATE INDEX "sync_run_orgId_idx" ON "sync_run"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "block_channelId_externalUid_key" ON "block"("channelId", "externalUid");

-- CreateIndex
CREATE UNIQUE INDEX "room_icalToken_key" ON "room"("icalToken");

-- AddForeignKey
ALTER TABLE "channel" ADD CONSTRAINT "channel_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel" ADD CONSTRAINT "channel_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_run" ADD CONSTRAINT "sync_run_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "block" ADD CONSTRAINT "block_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;



-- Same two guarantees as everything else that carries tenant data.
ALTER TABLE "channel"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_run" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channel_org_isolation" ON "channel"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

CREATE POLICY "sync_run_org_isolation" ON "sync_run"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
