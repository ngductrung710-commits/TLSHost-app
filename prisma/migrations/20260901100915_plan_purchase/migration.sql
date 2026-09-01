-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "plan_purchase" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "months" INTEGER NOT NULL DEFAULT 1,
    "amount" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plan_purchase_reference_key" ON "plan_purchase"("reference");

-- CreateIndex
CREATE INDEX "plan_purchase_orgId_idx" ON "plan_purchase"("orgId");

-- CreateIndex
CREATE INDEX "plan_purchase_status_idx" ON "plan_purchase"("status");

-- AddForeignKey
ALTER TABLE "plan_purchase" ADD CONSTRAINT "plan_purchase_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
