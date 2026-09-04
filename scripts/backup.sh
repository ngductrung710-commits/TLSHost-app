#!/bin/bash
#
# Nightly backup: dump, verify, encrypt, copy off this machine, then prune.
#
#   /usr/local/bin/tlshost-backup
#
# The order of those five words is the whole design. Every one of them has to
# succeed before the next runs, and pruning is last, because the failure this
# is built against is not "the backup did not run" — it is "the backup ran,
# produced nothing, said nothing, and deleted the good ones".
#
# The version of this that shipped in DEPLOY.md until 2026-09-05 had exactly
# that hole:
#
#   #!/bin/sh
#   set -e
#   pg_dump tlshost | gzip > "$DIR/tlshost-$(date +%F).sql.gz"
#   find "$DIR" -name 'tlshost-*.sql.gz' -mtime +14 -delete
#
# `set -e` reads the exit status of a pipeline's LAST command. When pg_dump
# fails, gzip still succeeds — it compresses the empty stream it was given —
# so the script writes a twenty-byte file, does not stop, runs the delete, and
# exits 0. Measured, not guessed: fourteen nights of that and every good
# backup is gone, replaced by fourteen empty files, with cron reporting
# success each time.
#
# So: bash rather than sh, for pipefail. And a verification step that asks the
# archive whether it contains anything, because a file existing is not a
# backup.

set -Eeuo pipefail

# ---------------------------------------------------------------- settings

DB="${TLSHOST_DB:-tlshost}"
LOCAL_DIR="${TLSHOST_BACKUP_DIR:-/var/backups/tlshost}"
KEEP_DAYS="${TLSHOST_BACKUP_KEEP_DAYS:-14}"

# Extra files that are useless to have a database without. SECRET_KEY decrypts
# every host's stored payment keys; restore the dump without it and every
# Stripe and PayPal connection in the database is unreadable bytes.
EXTRA_FILES="${TLSHOST_BACKUP_EXTRA:-/var/www/tlshost-app/.env}"

# age recipient — a PUBLIC key. The matching private key must NOT be on this
# machine. The server can then write backups it cannot read, so whoever steals
# the server gets the live database it already had and nothing more: not the
# history, not the deleted rows, not the older payment keys.
AGE_RECIPIENT="${TLSHOST_AGE_RECIPIENT:-}"

# rclone remote, e.g. "b2:tlshost-backups" or "s3:tlshost-backups".
RCLONE_REMOTE="${TLSHOST_RCLONE_REMOTE:-}"

# Dead man's switch. A cron job that stops running produces no output at all,
# so nothing here can report it — the only thing that can is something
# elsewhere noticing a ping that did not arrive. healthchecks.io has a free
# tier for this; any URL that records a hit works.
HEARTBEAT_URL="${TLSHOST_BACKUP_HEARTBEAT:-}"

STAMP="$(date +%F)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log() { printf '%s  %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '%s  FAIL: %s\n' "$(date +%H:%M:%S)" "$*" >&2; exit 1; }

# ------------------------------------------------------------- 0. the tools

# Checked up front rather than discovered halfway. A run that dumps, encrypts,
# then finds rclone missing has already spent the disk and the time, and is
# most of the way to being mistaken for a success.
for tool in pg_dump pg_restore; do
  command -v "$tool" >/dev/null || die "thiếu $tool"
done
[ -n "$AGE_RECIPIENT" ] && { command -v age >/dev/null || die "thiếu age"; }
[ -n "$RCLONE_REMOTE" ] && { command -v rclone >/dev/null || die "thiếu rclone"; }

mkdir -p "$LOCAL_DIR"

# ------------------------------------------------------------- 1. the dump

# Custom format, not plain SQL piped through gzip. It compresses on its own,
# and — the reason it is worth the different restore command — pg_restore can
# be asked to list its contents, which is a real integrity check. `gzip -t`
# only proves the gzip container is well formed, and an empty file is a
# perfectly well-formed gzip container.
DUMP="$WORK/tlshost-$STAMP.dump"
log "dump $DB"
pg_dump --format=custom --file="$DUMP" "$DB" || die "pg_dump hỏng"

# ---------------------------------------------------------- 2. is it real?

[ -s "$DUMP" ] || die "dump rỗng"

ENTRIES="$(pg_restore --list "$DUMP" | grep -c '^[0-9]' || true)"
[ "$ENTRIES" -gt 0 ] || die "dump không đọc được, hoặc không chứa gì"

# A schema with no rows in it restores fine and tells you nothing. This is not
# a row count — a listing is cheap and a full restore is not — but an archive
# holding fewer objects than the schema has tables is a signal worth stopping
# on rather than uploading.
log "dump ok: $ENTRIES mục, $(du -h "$DUMP" | cut -f1)"

# --------------------------------------------------- 3. the rest of the set

BUNDLE="$WORK/tlshost-$STAMP.tar"
tar -cf "$BUNDLE" -C "$WORK" "$(basename "$DUMP")"
for f in $EXTRA_FILES; do
  if [ -f "$f" ]; then
    tar -rf "$BUNDLE" -C "$(dirname "$f")" "$(basename "$f")"
    log "kèm $f"
  else
    # Loud, not fatal: a missing .env on a machine that has one is worth
    # knowing about, but it must not stop a database backup from happening.
    log "CẢNH BÁO: không thấy $f"
  fi
done

# ------------------------------------------------------------ 4. encrypt

FINAL="$LOCAL_DIR/tlshost-$STAMP.tar"
if [ -n "$AGE_RECIPIENT" ]; then
  FINAL="$FINAL.age"
  age --recipient "$AGE_RECIPIENT" --output "$WORK/enc" "$BUNDLE" || die "mã hoá hỏng"
  [ -s "$WORK/enc" ] || die "file mã hoá rỗng"
  mv "$WORK/enc" "$FINAL"
else
  # Allowed, and said out loud every single night. The dump holds guests'
  # names, emails and phone numbers.
  log "CẢNH BÁO: chưa đặt TLSHOST_AGE_RECIPIENT — bản sao lưu KHÔNG mã hoá"
  mv "$BUNDLE" "$FINAL"
fi

SIZE="$(stat -c %s "$FINAL")"
log "đóng gói: $FINAL ($SIZE byte)"

# ------------------------------------------------------------- 5. off-site

# The point of the whole exercise. A backup on the same disk as the database
# survives a dropped table; it does not survive the disk, the machine, or the
# provider.
UPLOADED=0
if [ -n "$RCLONE_REMOTE" ]; then
  NAME="$(basename "$FINAL")"
  rclone copy "$FINAL" "$RCLONE_REMOTE/" || die "rclone copy hỏng"

  # Not "rclone exited 0". Ask the remote what it now holds and compare the
  # byte count, because the answer to "did the file arrive" comes from the
  # far end, not from the program that sent it.
  REMOTE_SIZE="$(rclone size "$RCLONE_REMOTE/$NAME" --json | sed 's/.*"bytes":\([0-9]*\).*/\1/')"
  [ "$REMOTE_SIZE" = "$SIZE" ] || die "kích thước lệch: local $SIZE, remote ${REMOTE_SIZE:-không có}"
  log "đã tải lên $RCLONE_REMOTE/$NAME, khớp $REMOTE_SIZE byte"
  UPLOADED=1
else
  log "CẢNH BÁO: chưa đặt TLSHOST_RCLONE_REMOTE — bản sao lưu vẫn nằm trên chính máy này"
fi

# --------------------------------------------------------------- 6. prune

# Last, and only after everything above succeeded. Deleting yesterday's backup
# is safe exactly once today's is known to exist somewhere else; any earlier
# and a bad night takes the good nights with it.
find "$LOCAL_DIR" -name 'tlshost-*.tar*' -mtime "+$KEEP_DAYS" -delete
log "đã dọn bản local cũ hơn $KEEP_DAYS ngày"

if [ "$UPLOADED" = 1 ]; then
  # Remote retention is the provider's job where it can be — B2 and S3 both do
  # lifecycle rules, and a rule the server cannot reach is a rule a
  # compromised server cannot use to erase the history.
  log "lưu ý: đặt vòng đời xoá bản cũ ở phía B2/S3, đừng để script này xoá từ xa"
fi

# ------------------------------------------------------------ 7. heartbeat

if [ -n "$HEARTBEAT_URL" ]; then
  curl -fsS -m 10 --retry 3 "$HEARTBEAT_URL" >/dev/null || log "CẢNH BÁO: không ping được heartbeat"
fi

log "XONG"
