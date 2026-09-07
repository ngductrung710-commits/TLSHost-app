#!/bin/bash
#
# Bản sao khoá age này có đúng không?
#
#   scripts/verify-age-key.sh < duong-dan-toi-ban-sao
#   pbpaste | scripts/verify-age-key.sh          # dán từ giấy hoặc từ két mật khẩu
#
# Vì sao cần: một khoá chép sai vẫn trông y hệt khoá đúng. Nó dài, toàn chữ
# thường và chữ số, không có chỗ nào để mắt bám vào — chép nhầm 8 thành B hay
# bỏ sót một ký tự thì không ai nhận ra. Và cách duy nhất phát hiện là thử
# giải mã một bản sao lưu thật, tức là vào đúng ngày bạn cần nó nhất.
#
# Kịch bản này hỏi cùng câu đó trong hai giây, bằng cách suy ra khoá công khai
# từ bản sao rồi so với khoá công khai đã ghi trong DEPLOY.md. Hai khoá đi
# thành cặp: một khoá riêng chỉ sinh ra được đúng một khoá công khai, nên
# khớp nghĩa là bản sao đọc được mọi thứ đã mã hoá cho cặp này.
#
# Khoá đọc từ stdin và KHÔNG bao giờ ghi xuống đĩa: nó chỉ đi qua bộ nhớ. Không
# có tệp tạm nào để quên xoá, không có gì còn lại trong lịch sử shell.

set -Eeuo pipefail

# Khoá công khai, không phải khoá riêng. Chuỗi này công khai được — nó chỉ mã
# hoá được, không giải mã được gì — và để nó ngay đây là điều làm kịch bản này
# tự chạy được mà không cần tra cứu ở đâu khác.
EXPECTED="${TLSHOST_AGE_RECIPIENT:-age14supv3chharm9s8a409rl9h63c30zr9mp5evmapj6nfjnze2s48q48fy87}"

command -v age-keygen >/dev/null || {
  echo "LỖI: không thấy age-keygen. Cài age rồi chạy lại." >&2
  exit 1
}

[ -t 0 ] && {
  echo "Dán khoá riêng rồi Ctrl+D, hoặc: $0 < duong-dan-khoa" >&2
}

# age-keygen -y đọc identity từ tệp chứ không đọc stdin, nên phải qua một tệp.
# Đặt trong thư mục tạm riêng, chmod 600 TRƯỚC khi ghi, và xoá kể cả khi giữa
# chừng hỏng — bẫy đặt ngay sau khi tạo thư mục chứ không đặt ở cuối.
WORK="$(mktemp -d)"
chmod 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT INT TERM

KEYFILE="$WORK/k"
: > "$KEYFILE"
chmod 600 "$KEYFILE"
cat > "$KEYFILE"

[ -s "$KEYFILE" ] || { echo "LỖI: không nhận được gì từ stdin." >&2; exit 1; }

# 2>/dev/null: thông báo lỗi của age-keygen có thể nhắc lại nội dung dòng sai,
# và dòng sai đó là một nửa khoá riêng. Nuốt nó đi, tự nói bằng câu của mình.
GOT="$(age-keygen -y "$KEYFILE" 2>/dev/null || true)"

if [ -z "$GOT" ]; then
  echo "KHÔNG ĐẠT — đây không phải một khoá age hợp lệ."
  echo "           Kiểm tra xem đã chép đủ cả dòng AGE-SECRET-KEY-1... chưa."
  exit 1
fi

if [ "$GOT" = "$EXPECTED" ]; then
  echo "ĐẠT — bản sao này đúng."
  echo "      Khoá công khai: $GOT"
  exit 0
fi

echo "KHÔNG ĐẠT — bản sao này thuộc về một cặp khoá KHÁC."
echo "            Suy ra được: $GOT"
echo "            Đang mong đợi: $EXPECTED"
echo
echo "Nghĩa là bản sao này không mở được các bản sao lưu đã mã hoá."
echo "Hoặc bạn chép sai, hoặc đây là khoá của một lần sinh khác."
exit 1
