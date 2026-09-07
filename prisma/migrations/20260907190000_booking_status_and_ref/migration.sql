-- Thêm các trạng thái vòng đời của một lượt đặt, và một số đơn đọc được.

-- Thêm giá trị enum. Chỉ thêm, không dùng ngay trong migration này, nên chạy
-- gọn trong một giao dịch.
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING';
ALTER TYPE "BookingStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "BookingStatus" ADD VALUE 'CHECKED_OUT';
ALTER TYPE "BookingStatus" ADD VALUE 'NO_SHOW';

-- Số đơn theo từng tổ chức.
ALTER TABLE "booking" ADD COLUMN "ref" INTEGER;

-- Đánh số cho những đơn đã có: mỗi tổ chức đếm từ 1, theo thứ tự tạo. id đứng
-- sau createdAt trong ORDER BY để hai đơn tạo cùng một khoảnh khắc vẫn có thứ
-- tự ổn định.
WITH numbered AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY "orgId" ORDER BY "createdAt", id) AS rn
  FROM "booking"
)
UPDATE "booking" b
SET "ref" = n.rn
FROM numbered n
WHERE b.id = n.id;

-- Duy nhất trong một tổ chức. Nhiều NULL vẫn được (Postgres coi mỗi NULL là
-- khác nhau), nên cột này an toàn kể cả khi sau có đơn chưa kịp cấp số.
CREATE UNIQUE INDEX "booking_orgId_ref_key" ON "booking"("orgId", "ref");
