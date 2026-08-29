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
```

Ghi chú về từng biến:

- **`SHADOW_DATABASE_URL` không cần trên máy chủ.** Prisma chỉ dùng shadow
  database cho `migrate dev`, không dùng cho `migrate deploy`.
- **`ANTHROPIC_API_KEY` có thể để trống.** Trang Trợ lý sẽ tự giải thích và tắt
  đi; mọi thứ khác chạy bình thường.
- **`SECRET_KEY` không được đổi sau khi có chủ nhà kết nối cổng thanh toán.**
  Đổi nó làm mọi khoá Stripe/PayPal đã lưu không giải mã được nữa, và từng chủ
  nhà phải tự kết nối lại.

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
cd /var/www/tlshost && pm2 start npm --name tlshost-web -- start
```

```bash
cd /var/www/tlshost-app && PORT=3001 pm2 start npm --name tlshost-app -- start
```

`next start` đọc `PORT` từ môi trường. Truyền cổng qua `npm start -- --port`
cũng chạy, nhưng nó phải đi qua hai lớp `--` liên tiếp và im lặng rơi mất cổng
nếu một lớp bị viết sai — lúc đó ứng dụng chiếm cổng 3000 và đè lên trang giới
thiệu.

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

Rồi trên trình duyệt:

1. Tạo tài khoản chủ nhà đầu tiên tại `https://app.tlshost.vn/dang-ky`.
2. Thêm một chỗ nghỉ và vài phòng.
3. Mở Cài đặt — nếu phần **Thông báo đặt phòng** báo "Chưa cấu hình khoá VAPID",
   nghĩa là bạn đã build trước khi điền `.env`. Build lại và `pm2 restart tlshost-app`.
4. Bật trang đặt phòng công khai cho một chỗ nghỉ, mở link đó ở cửa sổ ẩn danh
   và đặt thử một lượt. Lượt đặt phải hiện ngay trên lịch.

---

## 9. Sao lưu

Cơ sở dữ liệu, hằng đêm:

```bash
sudo -u postgres pg_dump tlshost | gzip > /var/backups/tlshost-$(date +%F).sql.gz
```

Tự động hằng đêm. Viết thành một file script rồi cho cron gọi file đó — cron
hiểu `%` là ký tự đặc biệt, nên nhét cả dòng `date +%F` thẳng vào crontab là
cách thường gặp nhất để có một bản sao lưu không bao giờ chạy:

```bash
sudo mkdir -p /var/backups/tlshost && sudo chown postgres:postgres /var/backups/tlshost
```

```bash
sudo tee /usr/local/bin/tlshost-backup > /dev/null <<'SH'
#!/bin/sh
set -e
pg_dump tlshost | gzip > "/var/backups/tlshost/tlshost-$(date +%F).sql.gz"
find /var/backups/tlshost -name 'tlshost-*.sql.gz' -mtime +14 -delete
SH
```

```bash
sudo chmod +x /usr/local/bin/tlshost-backup
```

```bash
echo "0 3 * * * /usr/local/bin/tlshost-backup" | sudo -u postgres crontab -
```

Chạy thử một lần ngay, đừng đợi 3 giờ sáng mới biết nó hỏng:

```bash
sudo -u postgres /usr/local/bin/tlshost-backup && ls -lh /var/backups/tlshost/
```

**Sao lưu cơ sở dữ liệu là chưa đủ.** `SECRET_KEY` trong `.env` là thứ giải mã
khoá thanh toán của các chủ nhà. Khôi phục dump mà không có đúng khoá đó thì mọi
kết nối Stripe/PayPal đã lưu đều thành rác. Cất `.env` ở nơi khác máy chủ.

---

## 10. Cập nhật về sau

```bash
cd /var/www/tlshost-app && git pull && npm install && npx prisma migrate deploy && npm run build && npm run build:worker && pm2 restart tlshost-app
```

```bash
cd /var/www/tlshost && git pull && npm install && npm run build && pm2 restart tlshost-web
```

---

## Những việc còn lại, không thuộc phần triển khai

- **Năm file SVG logo kênh** cần lưu vào `tlshost/public/channels/`. Không có
  chúng thì dải logo trên trang giới thiệu hiện tên chữ thay cho hình.
- **`tlshost-app/README.md` vẫn là bản mẫu mặc định của Next.js.** Không ảnh
  hưởng gì đến vận hành, nhưng đó là thứ đầu tiên người tiếp theo đọc.
- **Các lệnh gọi thật tới Stripe và PayPal chưa được kiểm** — chưa từng có khoá
  thật trong môi trường phát triển. Kết nối bằng khoá `sk_test_` trước và chạy
  thử một lượt thanh toán. Chỗ đáng nghi nhất đã ghi chú sẵn trong
  `src/lib/payments.ts`: Stripe phải tự thay `{CHECKOUT_SESSION_ID}` vào URL
  trả về. Nếu chỗ đó sai, khách trả tiền xong sẽ quay về trang báo "chưa xác
  nhận được thanh toán".
