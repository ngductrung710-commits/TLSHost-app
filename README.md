# TLSHost — không gian làm việc

Phần mềm vận hành chỗ nghỉ cho chủ nhà độc lập ở Việt Nam: lịch đặt phòng, đồng
bộ kênh OTA hai chiều, buồng phòng, trang đặt phòng trực tiếp, trợ lý AI, và
thanh toán qua tài khoản Stripe/PayPal của chính chủ nhà.

Repo này là ứng dụng. Trang giới thiệu nằm ở repo `tlshost` bên cạnh.

Triển khai lên máy chủ: xem [DEPLOY.md](DEPLOY.md).

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Ngôn ngữ | TypeScript |
| Cơ sở dữ liệu | PostgreSQL 16 + Prisma 7 (driver adapter `@prisma/adapter-pg`) |
| Giao diện | Tailwind CSS v4, design token bằng CSS variable |
| Mật khẩu | Argon2id (`@node-rs/argon2`) |
| Trợ lý | Claude Opus 5, structured output có kiểm bằng schema |
| Runtime | Node 24 |

## Ba điều quyết định cách đọc mã nguồn này

**1. Ràng buộc thật nằm trong cơ sở dữ liệu, không nằm trong mã.**

Chặn trùng lịch là một `EXCLUDE USING gist` trên `booking` và trên `block`
(`prisma/migrations/20260828000100_guarantees`). Mã ứng dụng có kiểm trước và có
khoá dòng phòng, nhưng đó là để đưa ra thông báo tử tế — thứ thật sự khiến hai
request đồng thời không thể cùng bán một đêm là ràng buộc kia. Một màn hình có
thể quên kiểm; ràng buộc thì không.

**2. Ứng dụng kết nối bằng role KHÔNG phải chủ sở hữu bảng — kể cả khi phát triển.**

Row-level security không áp dụng cho chủ sở hữu bảng. Nếu chạy máy cá nhân bằng
user `postgres`, mọi chính sách cách ly giữa các cơ sở im lặng ngừng hoạt động,
và một truy vấn thiếu lọc `orgId` trông hoàn toàn bình thường cho tới lúc lên
máy chủ. Chạy `prisma/setup-role.sql` để tạo role `tlshost_app`, và để
`DATABASE_URL` trỏ vào đó. Cách ly dữ liệu vì vậy là thứ hoặc chạy được trên máy
bạn, hoặc hỏng trên máy bạn.

Mọi truy vấn dữ liệu khách hàng đi qua `withOrg()` trong `src/lib/db.ts`. Ngoài
transaction đó, chính sách trả về 0 dòng — quên gọi nó thì được một trang trống,
không bao giờ là dữ liệu của người khác.

**3. Trợ lý AI không bao giờ tự ghi.**

Nó soạn một đề xuất, lưu vào `AiProposal`, và chủ nhà bấm duyệt. Lúc duyệt,
payload được đọc lại từ cơ sở dữ liệu, kiểm lại bằng schema, rồi áp dụng qua
đúng những hàm mà form thủ công dùng — cùng kiểm quyền, cùng khoá phòng, cùng
ràng buộc. Không có đường nào từ mô hình xuống lịch mà không đi qua chỗ đó.

## Chạy trên máy cá nhân

Cần PostgreSQL 16 đang chạy.

```bash
npm install
```

```bash
sudo -u postgres psql -c "CREATE DATABASE tlshost;" -c "CREATE DATABASE tlshost_shadow;"
```

```bash
sudo -u postgres psql -d tlshost -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
```

```bash
sudo -u postgres psql -d tlshost -v password="'doi-mat-khau-nay'" -f prisma/setup-role.sql
```

Chép `.env.example` thành `.env` và điền. Tối thiểu cần `DATABASE_URL`,
`MIGRATE_DATABASE_URL`, `SHADOW_DATABASE_URL` và `SECRET_KEY`; `ANTHROPIC_API_KEY`
và bộ khoá VAPID có thể để trống — trang Trợ lý và phần thông báo sẽ tự giải
thích rồi tắt đi, mọi thứ khác chạy bình thường.

```bash
npx prisma migrate deploy && npx prisma generate
```

```bash
npm run dev
```

## Kiểm tra

```bash
npm run check
```

207 phép kiểm, phần lớn chạy trên PostgreSQL thật chứ không phải mock. Mỗi script
tự tạo cơ sở riêng và tự xoá, nên an toàn với cơ sở dữ liệu đang có dữ liệu.

| Script | Kiểm cái gì |
|---|---|
| `check:ical` | Parser và serializer RFC 5545 — gập dòng, DTEND của sự kiện cả ngày |
| `check:sync` | Đồng bộ kênh, chủ yếu là các chốt chặn xoá nhầm |
| `check:proposals` | Sáu loại đề xuất của trợ lý, áp dụng qua đúng các guard |
| `check:themes` | Độ tương phản WCAG của bốn phong cách trang đặt phòng |
| `check:appearance` | Bảng màu sáng/tối, và `color-scheme` ở chế độ theo hệ thống |
| `check:plans` | Bảng giá ở đây khớp với trang giá bên repo marketing |
| `check:payments` | Quy đổi tiền tệ và mã hoá khoá thanh toán |
| `check:i18n` | Mọi chuỗi tiếng Việt đều có bản tiếng Anh, và ngược lại |
| `check:sales` | Phòng trống: chồng lịch, nối đuôi, sức chứa, giá cả kỳ |

Hai script đáng đọc phần mở đầu trước khi sửa gì liên quan:
`scripts/check-sync.mjs` giải thích vì sao các chốt chặn xoá phải nghiêng về
phía giữ lại, và `scripts/check-i18n.mjs` giải thích vì sao một bản dịch làm
xong một nửa lại trông y hệt một bản dịch đã xong.

## Đồng bộ kênh

Chạy ngoài tiến trình web, theo giờ:

```bash
npm run sync
```

Trên máy chủ đây là một cron entry của PM2 — xem DEPLOY.md. Không phải một route
mà ứng dụng tự gọi theo hẹn giờ, vì kéo một tá feed OTA có thể mất cả phút chờ
mạng, và một lần đồng bộ hỏng không được phép kéo theo một trang nào chết.

## Ngôn ngữ

Không gian làm việc có tiếng Việt và tiếng Anh, chọn theo thiết bị (cookie), đổi
ở trang Cài đặt. Khoá của từ điển chính là câu tiếng Việt, nên thiếu bản dịch thì
hiện ra tiếng Việt chứ không hiện ra một đường dẫn dấu chấm.

Sửa câu tiếng Việt sẽ làm mồ côi bản dịch của nó. `npm run check:i18n` bắt cả hai
chiều — chuỗi chưa có bản dịch, và mục trong từ điển mà ứng dụng không còn nói.

Trang đặt phòng của khách **không** đi theo cài đặt này: ngôn ngữ ở đó là lựa
chọn của chỗ nghỉ, không phải của người đang đăng nhập.

## Cấu trúc

```
src/app/(auth)/     đăng nhập, đăng ký, nhận lời mời
src/app/(app)/      không gian làm việc — mọi trang sau khi đăng nhập
src/app/dat/        trang đặt phòng công khai của khách
src/app/feed/       xuất iCal cho các kênh OTA
src/lib/            truy cập dữ liệu, đồng bộ, trợ lý, thanh toán
src/i18n/en.ts      từ điển tiếng Anh
prisma/             schema, migration, setup-role.sql
scripts/            các script kiểm tra và worker đồng bộ
```
