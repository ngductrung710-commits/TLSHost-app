// Đếm lần thử sai, và lấy đúng IP.
//
//   npm run check:ratelimit
//
// Hai nửa, và nửa thứ hai là nửa dễ sai mà trông vẫn đúng.
//
// Đếm thì khó sai: một bộ đếm cửa sổ cố định hoặc chặn hoặc không. Còn việc
// lấy IP ra khỏi X-Forwarded-For thì có một cách sai rất phổ biến và im lặng —
// lấy phần tử đầu. Nginx ở đây cấu hình $proxy_add_x_forwarded_for, tức là NỐI
// THÊM địa chỉ thật vào cuối chuỗi mà client gửi lên. Client gửi
// "X-Forwarded-For: 1.2.3.4" thì ứng dụng nhận "1.2.3.4, <ip that>".
//
// Lấy phần tử đầu nghĩa là lấy đúng giá trị kẻ tấn công tự đặt: mỗi request
// một địa chỉ giả khác nhau, không bao giờ chạm giới hạn, mà mã nguồn thì
// trông như đang giới hạn.

import { bucketCount, clear, hit, pickClientIp, reset } from "../.tmp/ratelimit.mjs";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

/* -------------------------------------------------------------------- */
console.log("-- đếm tới giới hạn rồi chặn");

reset();
const allowed = [];
for (let i = 0; i < 7; i++) allowed.push(hit("a", 5, 900).allowed);
check("năm lần đầu qua, từ lần thứ sáu bị chặn", allowed, [
  true, true, true, true, true, false, false,
]);

const blocked = hit("a", 5, 900);
check("bị chặn thì nói còn bao lâu", blocked.allowed === false && blocked.retryAfterSeconds > 0, true);
check("và không quá cửa sổ", blocked.retryAfterSeconds <= 900, true);

/* -------------------------------------------------------------------- */
console.log("\n-- các khoá không ảnh hưởng nhau");

reset();
for (let i = 0; i < 6; i++) hit("mot@vi-du.vn", 5, 900);
check("khoá khác vẫn qua", hit("hai@vi-du.vn", 5, 900).allowed, true);
check("khoá cũ vẫn bị chặn", hit("mot@vi-du.vn", 5, 900).allowed, false);

/* -------------------------------------------------------------------- */
console.log("\n-- một lần đúng xoá sạch bộ đếm");

reset();
for (let i = 0; i < 4; i++) hit("b", 5, 900);
clear("b");
const sau = [];
for (let i = 0; i < 5; i++) sau.push(hit("b", 5, 900).allowed);
check("gõ sai bốn lần rồi đúng, không còn kề miệng hố", sau, [true, true, true, true, true]);

/* -------------------------------------------------------------------- */
console.log("\n-- cửa sổ hết hạn thì đếm lại từ đầu");

reset();
for (let i = 0; i < 6; i++) hit("c", 5, 1);
check("đang bị chặn", hit("c", 5, 1).allowed, false);
await new Promise((r) => setTimeout(r, 1100));
check("qua cửa sổ thì được thử lại", hit("c", 5, 1).allowed, true);

/* -------------------------------------------------------------------- */
console.log("\n-- không rò bộ nhớ theo số khoá đã từng thấy");

reset();
// Mô phỏng một kẻ tấn công quét qua rất nhiều email, mỗi cái một khoá mới.
for (let i = 0; i < 2000; i++) hit(`quet-${i}@vi-du.vn`, 5, 1);
await new Promise((r) => setTimeout(r, 1100));
const truocKhiDon = bucketCount();
// Một lần ghi nữa là đủ để kích hoạt quét dọn.
hit("sau-cung", 5, 900);
const sauKhiDon = bucketCount();
check("trước khi dọn giữ đủ 2000 khoá", truocKhiDon, 2000);
check("sau khi dọn chỉ còn khoá chưa hết hạn", sauKhiDon, 1);

/* -------------------------------------------------------------------- */
console.log("\n-- lấy IP: phần tử CUỐI, không phải phần tử đầu");

// Đây là nửa dễ sai. Nginx nối IP thật vào cuối, nên mọi thứ trước nó là do
// client tự đặt.
check(
  "một chặng: chính là nó",
  pickClientIp("203.0.113.9", null),
  "203.0.113.9",
);
check(
  "client giả mạo một địa chỉ ở đầu — lấy cái Nginx ghi ở cuối",
  pickClientIp("1.2.3.4, 203.0.113.9", null),
  "203.0.113.9",
);
check(
  "giả mạo cả một chuỗi dài cũng vậy",
  pickClientIp("1.1.1.1, 2.2.2.2, 3.3.3.3, 203.0.113.9", null),
  "203.0.113.9",
);
check("khoảng trắng thừa không tính", pickClientIp("  1.2.3.4 ,  203.0.113.9  ", null), "203.0.113.9");
check("chuỗi rỗng thì rơi về x-real-ip", pickClientIp("", "203.0.113.9"), "203.0.113.9");
check("dấu phẩy rỗng cũng vậy", pickClientIp(" , , ", "203.0.113.9"), "203.0.113.9");
check("không có header nào thì null", pickClientIp(null, null), null);
check("chỉ có x-real-ip", pickClientIp(null, "203.0.113.9"), "203.0.113.9");

// Cái test làm cả file này đáng viết: nếu ai đó đổi sang lấy phần tử đầu, thì
// mỗi request với một địa chỉ giả khác nhau sẽ ra một khoá khác nhau, và không
// bao giờ chạm giới hạn.
reset();
const giaMao = [];
for (let i = 0; i < 50; i++) {
  const ip = pickClientIp(`10.0.0.${i}, 203.0.113.9`, null);
  giaMao.push(hit(`signin:ip:${ip}`, 30, 900).allowed);
}
check(
  "50 request với 50 địa chỉ giả vẫn bị chặn sau 30 lần",
  giaMao.filter((x) => x === false).length,
  20,
);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
