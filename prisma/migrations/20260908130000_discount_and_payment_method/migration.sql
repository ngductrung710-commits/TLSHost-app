-- Giảm giá cho lượt đặt, và phương thức cho mỗi lần thu.

CREATE TYPE "BookingPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD', 'OTHER');

ALTER TABLE "booking" ADD COLUMN "discountCents" INTEGER;

ALTER TABLE "booking_payment"
  ADD COLUMN "method" "BookingPaymentMethod" NOT NULL DEFAULT 'CASH';
