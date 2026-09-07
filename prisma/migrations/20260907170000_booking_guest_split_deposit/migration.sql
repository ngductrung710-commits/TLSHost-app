-- Tách số khách và ghi lại tiền cọc.
--
-- Ngăn kéo tạo đơn hỏi riêng người lớn / trẻ em / em bé, và hỏi tiền cọc.
-- Trước đây bảng chỉ có một cột `guests`.

ALTER TABLE "booking"
  ADD COLUMN "adults"        INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "children"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "infants"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "depositCents"  INTEGER,
  ADD COLUMN "depositPaidAt" TIMESTAMP(3);

-- Những lượt đặt đã có không biết gì về phần tách, chỉ biết tổng. Mặc định 2
-- người lớn sẽ nói sai về một đơn 4 khách, và cái sai đó im lặng: tổng vẫn
-- đúng, chỉ phần tách là bịa. Cho tất cả vào cột người lớn — đó là điều duy
-- nhất dữ liệu cũ thật sự nói ra.
UPDATE "booking" SET "adults" = "guests";
