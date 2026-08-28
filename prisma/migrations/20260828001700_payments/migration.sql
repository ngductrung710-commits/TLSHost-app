-- Host-owned payment accounts, and one row per attempt to pay.
--
-- TLSHost never holds a guest's money. A host connects their own Stripe or
-- PayPal account, a guest pays into it directly, and this app only ever asks
-- that account to open a checkout and later asks whether it was paid. That is
-- why the marketing site can say 0% commission without an asterisk.
--
-- The provider secret is stored encrypted. A leaked backup must not hand over
-- the ability to move someone's money, and that is a different bar from the
-- rest of this database.


-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "payment_account" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "publicId" TEXT NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "live" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_account_orgId_provider_key" ON "payment_account"("orgId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "payment_externalId_key" ON "payment"("externalId");

-- CreateIndex
CREATE INDEX "payment_orgId_idx" ON "payment"("orgId");

-- CreateIndex
CREATE INDEX "payment_bookingId_idx" ON "payment"("bookingId");

-- AddForeignKey
ALTER TABLE "payment_account" ADD CONSTRAINT "payment_account_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;



ALTER TABLE "payment_account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment"         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_account_org_isolation" ON "payment_account"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));

CREATE POLICY "payment_org_isolation" ON "payment"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
