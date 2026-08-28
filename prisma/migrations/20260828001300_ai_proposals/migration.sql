-- Proposals the assistant drafted, waiting for a person.
--
-- Under the same policy as everything else that carries tenant data. Worth
-- saying explicitly: the assistant has no write path of its own. It produces a
-- row here, and the ordinary application code applies it only after a host
-- approves — through the same availability check and the same constraints a
-- host's own click goes through. There is no branch anywhere that lets a
-- proposal skip them.


-- CreateEnum
CREATE TYPE "ProposalKind" AS ENUM ('CREATE_BOOKING', 'BLOCK_NIGHTS', 'CANCEL_BOOKING', 'MOVE_BOOKING', 'SET_PRICE', 'NONE');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ai_proposal" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "kind" "ProposalKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdByMembershipId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_proposal_orgId_createdAt_idx" ON "ai_proposal"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_proposal" ADD CONSTRAINT "ai_proposal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;



ALTER TABLE "ai_proposal" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_proposal_org_isolation" ON "ai_proposal"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
