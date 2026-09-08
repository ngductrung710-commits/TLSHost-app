-- Lịch sử từng lần chủ nhà tự ghi nhận thanh toán cho một lượt đặt.

CREATE TABLE "booking_payment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "recordedByMembershipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_payment_orgId_idx" ON "booking_payment"("orgId");
CREATE INDEX "booking_payment_bookingId_idx" ON "booking_payment"("bookingId");

ALTER TABLE "booking_payment" ADD CONSTRAINT "booking_payment_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_payment" ADD CONSTRAINT "booking_payment_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_payment" ADD CONSTRAINT "booking_payment_recordedByMembershipId_fkey"
  FOREIGN KEY ("recordedByMembershipId") REFERENCES "membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cách ly theo tổ chức, cùng khuôn với mọi bảng tenant khác.
ALTER TABLE "booking_payment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_payment_org_isolation" ON "booking_payment"
  USING ("orgId" = current_setting('app.current_org_id', true))
  WITH CHECK ("orgId" = current_setting('app.current_org_id', true));
