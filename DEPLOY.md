# Triển khai lên VPS

Hướng dẫn cho một máy chủ Ubuntu trống (Hostinger hoặc bất kỳ VPS nào). Chạy
hai ứng dụng Next trên cùng một máy:

| | Cổng | Repo | Tên miền gợi ý |
|---|---|---|---|
| Trang giới thiệu | 3000 | `tlshost` | `tlshost.vn` |
| Không gian làm việc | 3001 | `tlshost-app` | `app.tlshost.vn` |

Nginx đứng trước cả hai, Postgres 16 chạy cùng máy, PM2 giữ tiến trình sống và
chạy đồng bộ kênh theo giờ.

---

## Trước khi bắt đầu: hai chỗ dễ mất buổi tối

Đọc hai mục này trước, vì cả hai đều hỏng theo kiểu **không báo lỗi**.

**1. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` được nhúng vào lúc build, không phải lúc chạy.**
Next thay thế mọi biến `NEXT_PUBLIC_*` thẳng vào gói JavaScript gửi cho trình
duyệt. Nếu bạn `npm run build` trước rồi mới điền khoá vào `.env`, ứng dụng vẫn
khởi động bình thường, mọi trang vẫn chạy, và phần bật thông báo lặng lẽ biến
mất khỏi trang Cài đặt như thể tính năng đó chưa từng tồn tại. **Điền `.env`
đầy đủ trước khi build.** Đổi khoá VAPID về sau thì phải build lại.

**2. Ứng dụng phải kết nối bằng role KHÔNG phải chủ sở hữu bảng.**
Row-level security trong PostgreSQL **không áp dụng cho chủ sở hữu bảng**. Nối
ứng dụng bằng user `postgres` thì mọi chính sách cách ly dữ liệu giữa các cơ sở
trong `20260828000100_guarantees` trở thành vô hiệu — không có lỗi nào, không
có cảnh báo nào, chỉ là mỗi cơ sở đọc được dữ liệu của cơ sở khác. `DATABASE_URL`
phải trỏ tới `tlshost_app`, và `MIGRATE_DATABASE_URL` (chủ sở hữu) chỉ dùng cho
migration, không bao giờ phục vụ request.

---

## 1. Cài đặt máy chủ

```bash
sudo apt update && sudo apt upgrade -y
```

Node 24 (khớp với máy phát triển):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt install -y nodejs
```

Postgres 16, Nginx, PM2, Git:

```bash
sudo apt install -y postgresql-16 postgresql-contrib-16 nginx git && sudo npm install -g pm2
```

Kiểm tra:

```bash
node --version && psql --version && nginx -v
```

---

## 2. Cơ sở dữ liệu

Tạo database và bật `btree_gist` — extension này là thứ cho phép ràng buộc
`EXCLUDE` chặn trùng lịch ở tầng cơ sở dữ liệu. Không có nó, migration đầu tiên
sẽ dừng lại.

```bash
sudo -u postgres psql -c "CREATE DATABASE tlshost;"
```

```bash
sudo -u postgres psql -d tlshost -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
```

Đặt mật khẩu cho user `postgres` (dùng cho migration):

```bash
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'MAT_KHAU_OWNER';"
```

Tạo role ứng dụng. Script này đã có sẵn trong repo và giải thích ngay trong file
vì sao phải tách role:

```bash
sudo -u postgres psql -d tlshost -v password="'MAT_KHAU_APP'" -f prisma/setup-role.sql
```

> Chạy script này **trước** migration đầu tiên. Nó cấp quyền cho các bảng hiện
> có *và* đặt default privileges cho bảng sinh ra sau này — nếu chạy sau, những
> bảng đã tạo sẽ không được cấp quyền, và triệu chứng là một trang trắng chứ
> không phải một thông báo lỗi.

---

## 3. Mã nguồn và biến môi trường

```bash
sudo mkdir -p /var/www && sudo chown $USER:$USER /var/www && cd /var/www
```

```bash
git clone https://github.com/<tai-khoan>/tlshost.git && git clone https://github.com/<tai-khoan>/tlshost-app.git
```

Sinh hai bí mật. Cả hai đều phải lưu ở chỗ bạn sao lưu cơ sở dữ liệu:

```bash
cd /var/www/tlshost-app && npm install
```

```bash
node -e "console.log('SECRET_KEY=' + require('crypto').randomBytes(32).toString('base64url'))"
```

```bash
node -e "const k=require('web-push').generateVAPIDKeys();console.log('NEXT_PUBLIC_VAPID_PUBLIC_KEY='+k.publicKey+'\nVAPID_PRIVATE_KEY='+k.privateKey)"
```

Tạo `/var/www/tlshost-app/.env` theo mẫu `.env.example`:

```bash
DATABASE_URL="postgresql://tlshost_app:MAT_KHAU_APP@localhost:5432/tlshost?schema=public"
MIGRATE_DATABASE_URL="postgresql://postgres:MAT_KHAU_OWNER@localhost:5432/tlshost?schema=public"

ANTHROPIC_API_KEY="sk-ant-..."

NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:ban@tlshost.vn"

SECRET_KEY="..."

TLSHOST_BANK_BIN="970423"
TLSHOST_BANK_ACCOUNT="..."
TLSHOST_BANK_ACCOUNT_NAME="NGUYEN VAN A"
TLSHOST_BANK_NAME="TPBank"
TLSHOST_BANK_CITY="Ha Noi"
```

Ghi chú về từng biến:

- **`SHADOW_DATABASE_URL` không cần trên máy chủ.** Prisma chỉ dùng shadow
  database cho `migrate dev`, không dùng cho `migrate deploy`.
- **`ANTHROPIC_API_KEY` có thể để trống.** Trang Trợ lý sẽ tự giải thích và tắt
  đi; mọi thứ khác chạy bình thường.
- **`SECRET_KEY` không được đổi sau khi có chủ nhà kết nối cổng thanh toán.**
  Đổi nó làm mọi khoá Stripe/PayPal đã lưu không giải mã được nữa, và từng chủ
  nhà phải tự kết nối lại.
- **Bốn biến `TLSHOST_BANK_*` là tài khoản *bạn* nhận tiền thuê bao**, không
  liên quan gì tới Stripe/PayPal mà chủ nhà kết nối để thu tiền khách. Phải có
  đủ bốn, hoặc không có cái nào: thiếu một cái thì trang thanh toán nói chưa
  cấu hình thay vì hiện một mã QR chuyển tiền đi đâu không ai nhận.
  `TLSHOST_BANK_CITY` là tuỳ chọn.
- **`TLSHOST_BANK_BIN` là mã Napas sáu chữ số, không phải mã SWIFT.** Đừng gõ
  theo trí nhớ — sai một chữ số là tiền sang ngân hàng khác. Lấy nó ra khỏi
  chính mã VietQR mà app ngân hàng của bạn sinh: mở app, lưu ảnh mã QR, rồi
  giải mã nó. Số tài khoản trong mã phải khớp với dãy số in trên đó.

Khoá quyền đọc file, vì nó chứa mật khẩu cơ sở dữ liệu và khoá giải mã:

```bash
chmod 600 /var/www/tlshost-app/.env
```

---

## 4. Migration

```bash
cd /var/www/tlshost-app && npx prisma migrate deploy
```

Sinh Prisma Client:

```bash
npx prisma generate
```

Kiểm tra RLS thật sự đang bật — câu này phải trả về `t` cho mọi bảng có dữ liệu
của khách hàng:

```bash
sudo -u postgres psql -d tlshost -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('organization','property','room','booking','block','membership') ORDER BY relname;"
```

---

## 5. Build

Trang giới thiệu:

```bash
cd /var/www/tlshost && npm install && npm run build
```

Không gian làm việc — nhắc lại: `.env` phải đầy đủ **trước** bước này:

```bash
cd /var/www/tlshost-app && npm run build
```

### Hai thư mục Next KHÔNG tự chép

Cả hai dự án bật `output: "standalone"`: Next viết ra một thư mục
`.next/standalone` chứa `server.js` và đúng những gói mà mã thật sự nạp — 102 MB
cho ứng dụng thay vì 782 MB `node_modules`, 30 MB cho trang giới thiệu thay vì
449 MB.

Nhưng nó **không** chép `.next/static` và `public/` vào đó, và không cảnh báo gì.
Bỏ hai lệnh dưới đây thì máy chủ vẫn khởi động, vẫn trả HTML, và **404 mọi file
CSS, JavaScript, ảnh** — trang hiện ra trần trụi chứ không phải trang báo lỗi,
nên rất dễ tưởng là lỗi CSS.

```bash
cd /var/www/tlshost && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
```

```bash
cd /var/www/tlshost-app && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
```

Chạy lại hai lệnh này **sau mỗi lần build**. `.next/standalone` bị xoá và tạo
lại mỗi lần, nên bản chép cũ biến mất cùng nó.

Build worker đồng bộ. Bước này bắt buộc và dễ quên: `scripts/sync-worker.mjs`
nạp `.tmp/sync.mjs`, mà `.tmp/` nằm trong `.gitignore` nên không có trong repo.
Thiếu bước này, cron chạy và fail mỗi giờ:

```bash
npm run build:worker
```

Chạy bộ kiểm tra một lần trên máy chủ để xác nhận cơ sở dữ liệu thật sự trả lời
đúng — bộ này tự tạo và tự xoá cơ sở riêng của nó, an toàn với dữ liệu thật:

```bash
npm run check
```

---

## 6. PM2

```bash
pm2 start /var/www/tlshost/.next/standalone/server.js --name tlshost-web --cwd /var/www/tlshost/.next/standalone
```

```bash
PORT=3001 pm2 start /var/www/tlshost-app/.next/standalone/server.js --name tlshost-app --cwd /var/www/tlshost-app/.next/standalone
```

Chạy thẳng `server.js`, không phải `npm start`. Với `output: "standalone"`,
`next start` vẫn chạy nhưng nó cần cả `node_modules` — tức là bỏ đi toàn bộ
điểm lợi của standalone.

`server.js` đọc `PORT` và `HOSTNAME` từ môi trường. Không có cách nào truyền
cổng bằng tham số dòng lệnh, nên không có cái bẫy `--` hai lớp mà `npm start`
từng có; đổi lại, quên `PORT` thì nó chiếm cổng 3000 và đè lên trang giới thiệu.

`--cwd` bắt buộc: `server.js` tìm `.next/`, `public/` và `.env` theo đường dẫn
tương đối so với thư mục làm việc.

Đồng bộ kênh mỗi giờ. Đây là cron một lần rồi thoát, không phải tiến trình chạy
mãi — không có gì cần giữ trong bộ nhớ giữa hai lần chạy, và một lần fail chỉ
đơn giản là chạy lại vào giờ sau:

```bash
pm2 start scripts/sync-worker.mjs --name tlshost-sync --cwd /var/www/tlshost-app --node-args="--env-file=.env" --cron-restart="0 * * * *" --no-autorestart
```

`--cwd` không thừa: worker nạp `.tmp/sync.mjs` theo đường dẫn tương đối, và
`--env-file=.env` cũng vậy. Chạy từ thư mục khác thì cả hai đều không tìm thấy.

```bash
pm2 save && pm2 startup
```

(Lệnh `pm2 startup` in ra một dòng `sudo ...` — chạy dòng đó.)

Xem log khi cần:

```bash
pm2 logs tlshost-sync --lines 50
```

---

## 7. Nginx và HTTPS

Trỏ DNS của `tlshost.vn` và `app.tlshost.vn` về IP của VPS trước, rồi:

```bash
sudo tee /etc/nginx/sites-available/tlshost > /dev/null <<'CONF'
# Vùng đếm cho form đăng nhập. Phải khai ở cấp http, ngoài mọi server block —
# đặt bên trong một server block là Nginx từ chối nạp cấu hình.
#
# $binary_remote_addr là địa chỉ TCP thật của kết nối, không phải header do
# client gửi, nên không giả mạo được. 10m đủ cho khoảng 160.000 địa chỉ.
limit_req_zone $binary_remote_addr zone=dangnhap:10m rate=10r/m;

server {
    listen 80;
    server_name tlshost.vn www.tlshost.vn;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name app.tlshost.vn;
    # Trang khách tự đặt phòng có thể tải logo, nên nới hơn mặc định 1M.
    client_max_body_size 4M;
    # Lớp thứ hai cho đăng nhập, trước cả khi request chạm tới ứng dụng.
    #
    # Ứng dụng đã tự đếm (src/lib/rateLimit.ts): 5 lần sai một email, 30 lần
    # một địa chỉ, trong 15 phút. Lớp này khác ở chỗ nó chặn sớm hơn — kẻ tấn
    # công không tiêu được CPU băm mật khẩu của máy chủ, và bộ đếm trong bộ nhớ
    # của ứng dụng không phình theo lưu lượng rác.
    #
    # burst=5 nodelay cho phép năm request dồn tức thời rồi mới siết, nên một
    # người gõ nhầm vài lần liên tiếp không bị 503.
    location = /dang-nhap {
        limit_req zone=dangnhap burst=5 nodelay;
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
CONF
```

```bash
sudo ln -sf /etc/nginx/sites-available/tlshost /etc/nginx/sites-enabled/ && sudo rm -f /etc/nginx/sites-enabled/default && sudo nginx -t && sudo systemctl reload nginx
```

Chứng chỉ TLS:

```bash
sudo apt install -y certbot python3-certbot-nginx && sudo certbot --nginx -d tlshost.vn -d www.tlshost.vn -d app.tlshost.vn
```

> HTTPS không phải tuỳ chọn ở đây. Service worker và thông báo đẩy chỉ hoạt động
> trên origin an toàn, và cookie phiên đăng nhập được đặt `secure` khi
> `NODE_ENV=production` — trên HTTP thuần, trình duyệt sẽ vứt cookie đi và không
> ai đăng nhập được.

Tường lửa:

```bash
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable
```

---

## 8. Kiểm tra sau khi lên

Chạy lần lượt, mỗi lệnh phải trả về `200`:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://tlshost.vn/vi
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://app.tlshost.vn/dang-nhap
```

Cookie phiên phải là `HttpOnly` và `Secure` — nếu thiếu `Secure`, `NODE_ENV`
chưa phải `production`:

```bash
curl -si https://app.tlshost.vn/dang-nhap | grep -i "set-cookie"
```

Và endpoint sức khoẻ phải nói được chuyện với Postgres — `200` kèm
`{"status":"ok"}`, không phải `503`:

```bash
curl -s https://app.tlshost.vn/suc-khoe
```

Rồi trên trình duyệt:

1. Tạo tài khoản chủ nhà đầu tiên tại `https://app.tlshost.vn/dang-ky`.
2. Thêm một chỗ nghỉ và vài phòng.
3. Mở Cài đặt — nếu phần **Thông báo đặt phòng** báo "Chưa cấu hình khoá VAPID",
   nghĩa là bạn đã build trước khi điền `.env`. Build lại và `pm2 restart tlshost-app`.
4. Bật trang đặt phòng công khai cho một chỗ nghỉ, mở link đó ở cửa sổ ẩn danh
   và đặt thử một lượt. Lượt đặt phải hiện ngay trên lịch.

---

## 9. Sao lưu

Script nằm trong repo: `scripts/backup.sh`. Đừng chép lại nội dung nó vào đây —
bản trong repo là bản được `npm run check:backup` kiểm, bản chép tay thì không.

### Vì sao không phải một dòng `pg_dump | gzip`

Bản tài liệu này trước 05/09/2026 ghi thế này, và nó sai:

```sh
#!/bin/sh
set -e
pg_dump tlshost | gzip > "$DIR/tlshost-$(date +%F).sql.gz"
find "$DIR" -name 'tlshost-*.sql.gz' -mtime +14 -delete
```

`set -e` chỉ đọc mã thoát của lệnh **cuối** đường ống. `pg_dump` hỏng thì `gzip`
vẫn thành công — nó nén cái luồng rỗng được đưa cho — nên script ghi ra một file
20 byte, không dừng lại, chạy tiếp lệnh xoá, và thoát 0. Chạy hỏng 14 đêm là mọi
bản sao lưu tốt bị xoá sạch, thay bằng 14 file rỗng, cron báo thành công mỗi đêm.

Bản mới dùng `bash` với `set -Eeuo pipefail`, dump ra định dạng `custom`, và hỏi
`pg_restore --list` xem file có chứa gì không trước khi làm bất cứ việc gì khác.
Lệnh dọn dẹp nằm **cuối cùng**, chỉ chạy sau khi bản mới đã có mặt ở nơi khác.

### Cài

```bash
sudo mkdir -p /var/backups/tlshost && sudo chown postgres:postgres /var/backups/tlshost
```

```bash
sudo install -m 755 /var/www/tlshost-app/scripts/backup.sh /usr/local/bin/tlshost-backup
```

### Khoá mã hoá — tạo ở máy bạn, không phải trên máy chủ

Bản dump chứa tên, email và số điện thoại của khách. Không đẩy nó lên bất kỳ
bucket nào ở dạng thô.

Trên **máy của bạn**, không phải trên VPS:

```bash
age-keygen -o tlshost-backup.key
```

File đó chứa cả khoá riêng. Cất nó ở nơi bạn giữ mật khẩu, và giữ ít nhất hai
bản. Mất nó là mất toàn bộ khả năng đọc lại các bản sao lưu.

Chỉ dòng `public key:` mới được lên máy chủ. Máy chủ ghi được bản sao lưu mà
không đọc được chúng — nên kẻ chiếm được máy chủ chỉ có đúng cơ sở dữ liệu đang
chạy mà họ vốn đã có, chứ không có lịch sử, không có những dòng đã xoá, không có
các khoá thanh toán cũ.

### Nơi cất — ngoài máy chủ

Backblaze B2 rẻ và đủ dùng. Tạo bucket riêng tư, tạo application key giới hạn
đúng bucket đó, rồi trên VPS:

```bash
sudo apt install -y age rclone && sudo -u postgres rclone config
```

Đặt tên remote là `b2`. Kiểm tra nó thấy được bucket:

```bash
sudo -u postgres rclone lsd b2:
```

### Cấu hình

```bash
sudo tee /etc/default/tlshost-backup > /dev/null <<'ENV'
TLSHOST_AGE_RECIPIENT=age1... # dán public key ở đây
TLSHOST_RCLONE_REMOTE=b2:tlshost-backups
TLSHOST_BACKUP_HEARTBEAT=https://hc-ping.com/... # xem mục dưới
ENV
```

```bash
sudo chmod 600 /etc/default/tlshost-backup && sudo chown postgres:postgres /etc/default/tlshost-backup
```

### Cron

`%` là ký tự đặc biệt với cron, nên mọi thứ phải nằm trong script chứ không nằm
trong dòng crontab:

```bash
echo '0 3 * * * . /etc/default/tlshost-backup && /usr/local/bin/tlshost-backup' | sudo -u postgres crontab -
```

Chạy thử ngay một lần, đừng đợi 3 giờ sáng mới biết nó hỏng:

```bash
sudo -u postgres sh -c '. /etc/default/tlshost-backup && /usr/local/bin/tlshost-backup'
```

### Chuông báo khi cron ngừng chạy

Một cron job chết thì không in ra gì cả — không có lỗi để đọc, không có mail để
nhận. Thứ duy nhất phát hiện được là một cú ping đã hẹn mà không tới. Tạo một
check ở healthchecks.io (miễn phí), đặt chu kỳ 1 ngày, dán URL vào
`TLSHOST_BACKUP_HEARTBEAT`. Script chỉ ping ở dòng cuối cùng, sau khi mọi bước
đã xong — nên im lặng nghĩa là hỏng, và bạn được báo.

### Khôi phục thử — làm một lần, rồi mỗi quý một lần

**Một bản sao lưu chưa từng khôi phục thì chưa phải bản sao lưu.** Vòng
dump → restore này đã được chạy thật trên lược đồ hiện tại ngày 05/09/2026: 17
bảng, cờ RLS, số policy và số dòng từng bảng đều khớp nguyên vẹn. RLS là chỗ
đáng lo nhất, vì mất policy nghĩa là các tổ chức đọc được dữ liệu của nhau, và
không có gì báo lỗi.

Tải bản mới nhất về máy bạn rồi giải mã:

```bash
rclone copy b2:tlshost-backups/tlshost-2026-09-05.tar.age .
```

```bash
age --decrypt --identity tlshost-backup.key tlshost-2026-09-05.tar.age > kho.tar && tar -xf kho.tar
```

Khôi phục vào một cơ sở dữ liệu **trống và khác tên** — không bao giờ vào CSDL
đang chạy:

```bash
createdb tlshost_thu && pg_restore -d tlshost_thu tlshost-2026-09-05.dump
```

So lại. Ba câu này phải cho cùng kết quả với CSDL thật:

```bash
psql -d tlshost_thu -c "select count(*) from booking" -c "select count(*) from property" -c "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' order by 1"
```

```bash
dropdb tlshost_thu
```

### Cái mà cơ sở dữ liệu không cứu được

`SECRET_KEY` trong `.env` là thứ giải mã khoá thanh toán của các chủ nhà. Khôi
phục dump mà không có đúng khoá đó thì mọi kết nối Stripe/PayPal đã lưu đều
thành rác. Script đã tự đóng gói `.env` vào cùng kho lưu trữ — đó là lý do biến
`TLSHOST_BACKUP_EXTRA` tồn tại — nhưng hãy kiểm tra dòng `kèm ...` có trong log
lần chạy đầu tiên.

---

## 10. Cập nhật về sau

```bash
cd /var/www/tlshost-app && git pull && npm install && npx prisma migrate deploy && npm run build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/ && npm run build:worker && pm2 restart tlshost-app
```

```bash
cd /var/www/tlshost && git pull && npm install && npm run build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/ && pm2 restart tlshost-web
```

Hai lệnh `cp` nằm giữa `build` và `restart` là bắt buộc, không phải tuỳ chọn —
xem mục 5.

---

## Giám sát

Máy chủ chết lúc 2 giờ sáng thì không có gì báo cho bạn. Cách rẻ nhất để biết
là một dịch vụ bên ngoài gọi vào mỗi vài phút.

Ứng dụng có sẵn một endpoint cho việc đó:

```bash
curl -i https://app.tlshost.vn/suc-khoe
```

Khoẻ thì `200` và `{"status":"ok","ms":12}`. Không nói được chuyện với Postgres
thì `503` và `{"status":"down"}`.

**Đừng trỏ giám sát vào trang đăng nhập.** Đó là sai lầm mặc định, và nó im
lặng: khi Postgres chết, `/dang-nhap` vẫn trả `200` vì trang đó không đọc cơ sở
dữ liệu — trong khi lịch trống trơn với mọi chủ nhà và không lượt đặt nào lưu
được. Đã thử đúng tình huống đó: `/suc-khoe` trả 503 còn `/dang-nhap` trả 200.

Thân trả về cố tình gần như không nói gì. Đây là URL công khai, ai cũng gọi
được, và một endpoint sức khoẻ kể ra thành phần nào hỏng với lỗi gì là một
endpoint do thám. Chi tiết nằm trong log của PM2.

Dựng cảnh báo, khoảng năm phút:

1. Tạo tài khoản ở uptimerobot.com — gói miễn phí đủ dùng.
2. **Add New Monitor** → loại **HTTP(s)**.
3. URL: `https://app.tlshost.vn/suc-khoe`
4. **Monitoring interval**: 5 phút.
5. Bật thông báo qua email, và cả Telegram nếu bạn muốn biết ngay.
6. Thêm một monitor nữa cho `https://tlshost.vn/vi` — trang giới thiệu không
   đụng cơ sở dữ liệu nên nó là một tín hiệu khác: máy chủ và Nginx còn sống
   hay không.

Tắt máy chủ một phút rồi xem có nhận được cảnh báo không. Một hệ thống giám sát
chưa từng báo động là một hệ thống chưa biết có chạy hay không.

---

## Hai lệnh vận hành

Không có thanh toán thuê bao tự động và không có trang quản trị. Hai việc dưới
đây làm bằng dòng lệnh, trên máy chủ, trong thư mục `tlshost-app`.

**Đổi gói cho một tổ chức.** Dùng khi cấp tay, khi hoàn tiền, hoặc khi thử.

```bash
npm run plan -- chu-nha@vi-du.vn PRO 12
```

Bỏ tên gói thì chỉ xem, không đổi gì. Bỏ số tháng thì gói không có hạn kết
thúc — và một gói trả phí không hạn sẽ *chặn* nút mua, vì mua thêm một tháng
đè lên "vô thời hạn" là rút ngắn chứ không phải gia hạn.

**Xác nhận đã nhận tiền chuyển khoản.** Sao kê ngân hàng chưa nối vào đâu cả,
nên phải có người đọc rồi xác nhận.

```bash
npm run purchases
```

```bash
npm run purchases -- TLSABC1234
```

Xác nhận hai lần là an toàn: lần thứ hai báo đơn đã xử lý và không cộng thêm
tháng nào. Đó là ràng buộc ở tầng cơ sở dữ liệu, không phải ở tầng nút bấm.

---

## Những việc còn lại, không thuộc phần triển khai

- **Logo kênh: giữ nguyên như hiện tại, quyết ngày 05/09/2026.** Bảy file
  trong `tlshost/public/channels/` lấy từ trang sưu tầm chứ không phải bộ nhận
  diện chính thức; chỉ Airbnb và Booking.com là bản gốc, màu những cái còn lại
  có thể lệch so với bản chuẩn của từng hãng. Chủ sản phẩm đã cân nhắc và chọn
  dùng tiếp — đây không còn là việc phải làm.
  Cần xem lại nếu một trong các hãng có ý kiến, hoặc khi làm một đợt chỉnh bộ
  nhận diện. `tlshost/public/channels/README.md` ghi nơi lấy asset chính thức
  của từng hãng và điều kiện sử dụng logo của họ.
- **Giới hạn đăng nhập chỉ chặn được kẻ tấn công, không chặn được kẻ kiên
  nhẫn.** Năm lần sai một email trong mười lăm phút là đủ để dập một cuộc dò
  mật khẩu tự động, nhưng ai đó thử năm mật khẩu mỗi mười lăm phút suốt một
  tuần thì vẫn thử được vài trăm lần. Chống điều đó cần mật khẩu mạnh và xác
  thực hai lớp, cả hai đều chưa có.
- **`ANTHROPIC_API_KEY` chưa có.** Trang Trợ lý tự giải thích và tắt đi, mọi
  thứ khác chạy bình thường. Tuỳ chọn, không chặn triển khai.
- **Mã VietQR đã được app TPBank thật quét, ngày 04/09/2026.** Mã sinh bởi
  `qrPayloadFor()` từ các biến `TLSHOST_BANK_*` đang chạy, app đọc ra đúng ngân
  hàng, đúng số tài khoản, đúng chủ tài khoản, số tiền và nội dung đều điền
  sẵn. Bố cục thẻ đã được xác nhận với Napas, không còn là suy đoán. **Quét lại
  bằng tay mỗi khi thẻ 38 đổi** — số tài khoản, BIN, hay mã dịch vụ — vì đó là
  phần `check:vietqr` không kiểm được.
- **PayPal đã chạy thật tới bước tạo đơn; phần thu tiền thì chưa.** Với khoá
  sandbox, `testCredentials()`, `createCheckout()` và `startPayment()` đều đã
  chạy và tạo được đơn thật trên PayPal. `verifyPayment()` thì **chưa chạy lần
  nào** — và nó *capture*, tức chuyển tiền, chứ không phải đọc. Câu chưa ai trả
  lời được là gọi nó hai lần thì sao, vì đó đúng là điều xảy ra khi khách bấm
  tải lại trang xác nhận.
- **PayPal không nhận VND.** Đo ngày 04/09/2026: tạo đơn với `currency_code`
  là VND trả về 422 `CURRENCY_NOT_SUPPORTED`, KRW cũng vậy. Cơ sở tính bằng
  đồng thì không dùng được PayPal, và màn hình Cài đặt nay nói thẳng điều đó
  thay vì để chủ nhà phát hiện lúc khách đang cầm thẻ.
- **Stripe vẫn chưa chạy lần nào.** Kết nối bằng khoá `sk_test_` rồi chạy thử
  một lượt thanh toán. Chỗ đáng nghi nhất đã ghi chú sẵn trong
  `src/lib/payments.ts`: Stripe phải tự thay `{CHECKOUT_SESSION_ID}` vào URL
  trả về. Nếu chỗ đó sai, khách trả tiền xong sẽ quay về trang báo "chưa xác
  nhận được thanh toán".
