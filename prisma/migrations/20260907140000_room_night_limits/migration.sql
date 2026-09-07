-- Số đêm ít nhất và nhiều nhất cho một lượt đặt vào từng phòng.
--
-- minNights mặc định 1: "không giới hạn" ở đầu dưới không phải trạng thái có
-- thật, mọi lượt đặt đều ít nhất một đêm. maxNights để NULL được, vì "không
-- giới hạn" ở đầu trên thì có thật — và lưu một con số to giả vờ làm vô hạn
-- là thứ sau này sẽ có người đem ra so sánh.
ALTER TABLE "room" ADD COLUMN     "maxNights" INTEGER,
ADD COLUMN     "minNights" INTEGER NOT NULL DEFAULT 1;
