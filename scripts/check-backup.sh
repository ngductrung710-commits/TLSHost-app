#!/bin/bash
# The backup script, made to fail on purpose.
#
#   npm run check:backup
#
# What this guards is one sentence: a dump that did not work must not delete
# the dumps that did. That is not a hypothetical — the version in DEPLOY.md
# until 2026-09-05 got it wrong, and got it wrong silently, because `set -e`
# reads only the last command of a pipeline and gzip is happy to compress
# nothing at all. Fourteen nights of a database that would not answer and
# every good backup was gone, with cron reporting success each time.
#
# Three of the four cases here need no database. They replace pg_dump with a
# shim that fails in a specific way and then ask two questions: did the script
# stop, and is the old backup still there. The fourth runs the real thing,
# because a script that refuses everything would pass all three.

set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
SHIM="$WORK/shim"
trap 'rm -rf "$WORK"' EXIT

# pg_dump lives on PATH on a server and under Program Files on a Windows dev
# box. Missing entirely is a hard stop rather than a skip: a check that quietly
# passes when it could not run is the thing this whole file exists to argue
# against.
if ! command -v pg_dump >/dev/null; then
  WIN="/c/Program Files/PostgreSQL/16/bin"
  [ -x "$WIN/pg_dump.exe" ] || {
    echo "FAIL  không tìm thấy pg_dump — cài PostgreSQL client rồi chạy lại" >&2
    exit 1
  }
  PATH="$WIN:$PATH"
fi

# Connection details from .env, the same source every other check reads. The
# backup script speaks to Postgres through libpq's own variables rather than a
# URL, because that is what it will have on a server running as the postgres
# user.
ENV_FILE="$REPO/.env"
[ -f "$ENV_FILE" ] || { echo "FAIL  không thấy .env" >&2; exit 1; }
URL="$(grep '^MIGRATE_DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"')"
[ -n "$URL" ] || { echo "FAIL  .env không có MIGRATE_DATABASE_URL" >&2; exit 1; }
PGUSER="$(printf '%s' "$URL" | sed 's|.*://||;s|:.*||')"
PGPASSWORD="$(printf '%s' "$URL" | sed 's|.*://[^:]*:||;s|@.*||')"
PGHOST="$(printf '%s' "$URL" | sed 's|.*@||;s|:.*||')"
export PGUSER PGPASSWORD PGHOST

failures=0
prepare() {
  rm -rf "$WORK/dir" "$SHIM"
  mkdir -p "$WORK/dir" "$SHIM"
  echo "một bản sao lưu tốt" > "$WORK/dir/tlshost-2000-01-01.tar"
  touch -d '30 days ago' "$WORK/dir/tlshost-2000-01-01.tar"
}

run_case() {
  local name="$1" want_code="$2" want_old="$3"
  (
    cd "$REPO" || exit 99
    PATH="$SHIM:$PATH" TLSHOST_BACKUP_DIR="$WORK/dir" TLSHOST_BACKUP_EXTRA="" \
      bash scripts/backup.sh > "$WORK/out.txt" 2>&1
  )
  # Read outside a pipeline. Piping this into sed and then reading PIPESTATUS
  # from out here reports sed's status, which is 0 whatever the script did —
  # the first version of this harness passed all three failure cases that way.
  local code=$?

  local ok=1
  if [ "$want_code" = 0 ]; then [ "$code" -eq 0 ] || ok=0; else [ "$code" -ne 0 ] || ok=0; fi
  local old=MAT
  [ -f "$WORK/dir/tlshost-2000-01-01.tar" ] && old=CON
  [ "$old" = "$want_old" ] || ok=0

  if [ "$ok" = 1 ]; then
    echo "PASS  $name — thoát $code, bản cũ $old"
  else
    failures=$((failures + 1))
    echo "FAIL  $name"
    echo "      thoát $code (mong $want_code), bản cũ $old (mong $want_old)"
    sed 's/^/      /' "$WORK/out.txt"
  fi
}

echo "-- một lần dump hỏng không được xoá những lần dump tốt"

prepare
printf '#!/bin/bash\necho "pg_dump: error: connection failed" >&2\nexit 1\n' > "$SHIM/pg_dump"
chmod +x "$SHIM/pg_dump"
run_case "pg_dump thoát khác 0" 1 CON

prepare
printf '#!/bin/bash\nfor a in "$@"; do case "$a" in --file=*) : > "${a#--file=}";; esac; done\nexit 0\n' > "$SHIM/pg_dump"
chmod +x "$SHIM/pg_dump"
run_case "pg_dump thoát 0 nhưng file rỗng" 1 CON

prepare
printf '#!/bin/bash\nfor a in "$@"; do case "$a" in --file=*) echo rac > "${a#--file=}";; esac; done\nexit 0\n' > "$SHIM/pg_dump"
chmod +x "$SHIM/pg_dump"
run_case "pg_dump thoát 0 nhưng file không phải kho lưu trữ" 1 CON

echo ""
echo "-- và một lần dump tốt thì phải chạy trọn"

# Without this a script that simply refused to do anything would pass every
# case above.
prepare
run_case "pg_dump thật, dọn bản quá hạn" 0 MAT

echo ""
if [ "$failures" = 0 ]; then
  echo "all checks passed"
else
  echo "$failures FAILED"
  exit 1
fi
