-- Khôi phục mật khẩu.
--
-- Băm của token, không bao giờ là token — cùng luật mà bảng session và cột
-- mời thành viên đang theo. Một bản sao lưu rò rỉ không được phép trao đi khả
-- năng chiếm tài khoản.
--
-- UNIQUE để hai liên kết còn sống không thể trùng nhau, và cho phép NULL vì
-- gần như mọi dòng không có yêu cầu nào đang chờ. Cột được xoá ngay khi dùng,
-- và đó là thứ khiến một liên kết chỉ dùng được một lần.
ALTER TABLE "user" ADD COLUMN     "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetTokenHash" TEXT;

CREATE UNIQUE INDEX "user_passwordResetTokenHash_key" ON "user"("passwordResetTokenHash");
