#!/bin/bash
#
# Diễn tập phục hồi: giải mã một bản sao lưu thật, dựng lại vào một cơ sở dữ
# liệu tạm, đếm xem có gì trong đó, rồi xoá cơ sở dữ liệu tạm đi.
#
#   scripts/restore-drill.sh /var/backups/tlshost/tlshost-2026-09-06.tar.age
#
# Vì sao cần: scripts/backup.sh kiểm tra được rằng nó vừa ghi ra một tệp không
# rỗng, và chỉ thế thôi. Nó không biết tệp đó có giải mã được không, có dựng
# lại được không, hay bên trong có phải là cơ sở dữ liệu của bạn không. Ba câu
# đó chỉ có một cách trả lời, và trả lời vào ngày ổ cứng chết thì đã muộn.
#
# Câu quan trọng nhất mà bài này trả lời không nằm ở phần mềm: nó là "tờ giấy
# chép khoá age có đúng không". Khoá riêng không nằm trên máy chủ — đó là chủ
# ý — nên bản sao duy nhất là bản bạn cất đi. Một ký tự chép sai thì mọi bản
# sao lưu đã mã hoá từ trước tới nay đều là rác, và không có gì trên đời báo
# cho bạn biết điều đó trừ bài diễn tập này.
#
# Khoá được đọc từ stdin và không bao giờ ghi xuống đĩa:
#
#   scripts/restore-drill.sh ban-sao-luu.tar.age < duong-dan-khoa
#   pbpaste | scripts/restore-drill.sh ban-sao-luu.tar.age      # dán từ giấy
#
# Nên chạy mỗi quý một lần, và bắt buộc sau khi đổi khoá age.

set -Eeuo pipefail

# ---------------------------------------------------------------- settings

# Một URL có quyền tạo và xoá cơ sở dữ liệu. Trên máy chủ thật đây là vai trò
# postgres, không phải tlshost_app — vai trò ứng dụng cố tình không có quyền đó.
ADMIN_URL="${TLSHOST_RESTORE_URL:-${MIGRATE_DATABASE_URL:-}}"

# Tên cơ sở dữ liệu tạm. Bị xoá lúc kết thúc, kể cả khi giữa chừng hỏng.
SCRATCH="${TLSHOST_RESTORE_DB:-tlshost_restore_drill}"

KEEP=0
ARCHIVE=""
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP=1 ;;
    -*) echo "tham số lạ: $arg" >&2; exit 2 ;;
    *) ARCHIVE="$arg" ;;
  esac
done

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '%s  LỖI: %s\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }

# ------------------------------------------------------------ 0. điều kiện

[ -n "$ARCHIVE" ] || die "thiếu đường dẫn bản sao lưu"
[ -f "$ARCHIVE" ] || die "không thấy $ARCHIVE"
[ -n "$ADMIN_URL" ] || die "thiếu TLSHOST_RESTORE_URL (hoặc MIGRATE_DATABASE_URL)"

for cmd in psql pg_restore tar; do
  command -v "$cmd" >/dev/null || die "thiếu $cmd"
done
case "$ARCHIVE" in
  *.age) command -v age >/dev/null || die "thiếu age" ;;
esac

# Phần truy vấn bị cắt bỏ hẳn, không phải giữ lại. URL trong prisma.config.ts
# kết thúc bằng ?schema=public — đó là cú pháp của Prisma, còn libpq thì từ
# chối thẳng: "invalid URI query parameter: schema". psql và pg_restore chọn
# schema qua search_path chứ không qua URL, nên bỏ đi là đúng chứ không phải
# đánh mất thứ gì.
ADMIN_URL="${ADMIN_URL%%\?*}"
PREFIX="${ADMIN_URL%/*}"
LIVE_DB="${ADMIN_URL##*/}"
SCRATCH_URL="$PREFIX/$SCRATCH"

# Chốt chặn, đặt trước mọi thao tác ghi. Kịch bản này XOÁ cơ sở dữ liệu tên
# $SCRATCH ở cuối, nên nếu tên đó trùng cơ sở dữ liệu thật thì bài diễn tập
# phục hồi sẽ tự tay xoá đúng thứ nó đang tập cứu.
[ "$SCRATCH" != "$LIVE_DB" ] || die "TLSHOST_RESTORE_DB trùng tên cơ sở dữ liệu thật ($LIVE_DB)"

# Và từ chối nếu tên đó đã có sẵn: nó có thể là của người khác, và kịch bản
# này không có cách nào biết. Từ chối, không cảnh báo rồi làm tiếp.
EXISTS="$(psql -d "$ADMIN_URL" -t -A -c "SELECT 1 FROM pg_database WHERE datname = '$SCRATCH'")"
[ -z "$EXISTS" ] || die "cơ sở dữ liệu $SCRATCH đã tồn tại — xoá tay rồi chạy lại"

WORK="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK"
  if [ "$KEEP" = "0" ]; then
    psql -d "$ADMIN_URL" -q -c "DROP DATABASE IF EXISTS \"$SCRATCH\"" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# ------------------------------------------------------------ 1. giải mã

BUNDLE="$WORK/bundle.tar"
case "$ARCHIVE" in
  *.age)
    log "giải mã $ARCHIVE — dán khoá riêng rồi Ctrl+D"
    # -i - : khoá đọc từ stdin. Không ghi ra tệp nào, nên không có gì để quên
    # xoá sau đó.
    age -d -i - -o "$BUNDLE" "$ARCHIVE" || die "giải mã hỏng — khoá sai, hoặc tệp hỏng"
    [ -s "$BUNDLE" ] || die "giải mã ra tệp rỗng"
    log "giải mã ok"
    ;;
  *)
    log "CẢNH BÁO: $ARCHIVE chưa mã hoá — bài này không kiểm tra được khoá"
    cp "$ARCHIVE" "$BUNDLE"
    ;;
esac

# ------------------------------------------------------------ 2. mở gói

tar -xf "$BUNDLE" -C "$WORK" || die "giải nén hỏng"
DUMP="$(find "$WORK" -maxdepth 1 -name '*.dump' | head -1)"
[ -n "$DUMP" ] || die "trong gói không có tệp .dump nào"

ENTRIES="$(pg_restore --list "$DUMP" | grep -c '^[0-9]' || true)"
[ "$ENTRIES" -gt 0 ] || die "bản dump không có mục nào"
log "gói ok: $ENTRIES mục"

if find "$WORK" -maxdepth 1 -name '.env' | grep -q .; then
  log "trong gói có .env — khoá giải mã cổng thanh toán còn nguyên"
else
  log "CẢNH BÁO: trong gói KHÔNG có .env — dựng lại được dữ liệu nhưng"
  log "          mọi kết nối Stripe/PayPal đã lưu sẽ là byte vô nghĩa"
fi

# ---------------------------------------------------------- 3. dựng lại

log "tạo $SCRATCH"
psql -d "$ADMIN_URL" -q -c "CREATE DATABASE \"$SCRATCH\"" || die "không tạo được $SCRATCH"

# --no-owner --no-privileges: máy đang diễn tập không nhất thiết có những vai
# trò mà máy chủ thật có, và bài này hỏi "dữ liệu còn nguyên không", không hỏi
# "quyền hạn còn nguyên không".
pg_restore --dbname "$SCRATCH_URL" --no-owner --no-privileges "$DUMP" \
  || die "pg_restore hỏng"
log "dựng lại xong"

# ------------------------------------------------------------ 4. đếm

q() { psql -d "$SCRATCH_URL" -t -A -c "$1"; }

TABLES="$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
[ "$TABLES" -gt 0 ] || die "dựng xong nhưng không có bảng nào"

echo
printf '  %-18s %s\n' "bảng" "dòng"
for t in organization "user" property room booking payment channel block; do
  printf '  %-18s %s\n' "$t" "$(q "SELECT count(*) FROM \"$t\"")"
done
echo

# Một câu hỏi về tính toàn vẹn, không phải về số lượng: một bản dump dựng
# thiếu thứ tự sẽ cho ra những đơn đặt trỏ vào phòng không tồn tại.
ORPHANS="$(q "SELECT count(*) FROM booking b LEFT JOIN room r ON r.id = b.\"roomId\" WHERE r.id IS NULL")"
[ "$ORPHANS" = "0" ] || die "$ORPHANS đơn đặt trỏ vào phòng không có thật"

# SQL ở đây chỉ dùng ASCII, và cái nhãn tiếng Việt được ghép ở phía shell.
# psql -c gửi câu lệnh theo bảng mã của máy khách, mà trên Windows bảng mã đó
# không phải UTF-8 — một chữ "ô" trong chuỗi SQL đủ để Postgres trả về
# "invalid byte sequence for encoding UTF8" và cả bài diễn tập dừng ở dòng
# cuối cùng. Đo được, không phải đoán.
NEWEST="$(q "SELECT max(\"createdAt\")::text FROM booking")"
[ -n "$NEWEST" ] || NEWEST="chưa có đơn nào"
log "$TABLES bảng, không có đơn mồ côi, đơn mới nhất: $NEWEST"

# ------------------------------------------------------- 5. RLS còn không

# Đây là câu đáng sợ nhất trong cả bài, và là câu duy nhất mà việc đếm dòng
# không trả lời được. Một bản dump khôi phục đủ 10 đơn đặt nhưng thiếu policy
# thì trông y hệt một bản khôi phục tốt — chỉ khác là mọi tổ chức đọc được dữ
# liệu của nhau, và không có gì báo lỗi, không bao giờ.
#
# So với cơ sở dữ liệu thật chứ không so với một con số chép cứng: lược đồ còn
# thay đổi, và một con số chép cứng sẽ lặng lẽ hết đúng ở lần migrate sau.
RLS_SQL="SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity"
POL_SQL="SELECT count(*) FROM pg_policies WHERE schemaname = 'public'"

live() { psql -d "$ADMIN_URL" -t -A -c "$1"; }

RLS_NEW="$(q "$RLS_SQL")"; RLS_LIVE="$(live "$RLS_SQL")"
POL_NEW="$(q "$POL_SQL")"; POL_LIVE="$(live "$POL_SQL")"

[ "$RLS_NEW" = "$RLS_LIVE" ] \
  || die "bật RLS trên $RLS_NEW bảng, cơ sở dữ liệu thật có $RLS_LIVE — khôi phục xong các tổ chức sẽ đọc được dữ liệu của nhau"
[ "$POL_NEW" = "$POL_LIVE" ] \
  || die "có $POL_NEW policy, cơ sở dữ liệu thật có $POL_LIVE"

log "RLS: $RLS_NEW bảng bật, $POL_NEW policy — khớp cơ sở dữ liệu thật"

# ------------------------------------------------------------ 5. kết

if [ "$KEEP" = "1" ]; then
  log "giữ lại $SCRATCH theo yêu cầu — nhớ xoá tay"
  trap - EXIT
  rm -rf "$WORK"
else
  log "xoá $SCRATCH"
fi

echo
log "DIỄN TẬP ĐẠT — bản sao lưu này phục hồi được"
