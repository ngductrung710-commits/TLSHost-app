// Luật mật khẩu: cái gì bị từ chối, và quan trọng hơn — cái gì phải được nhận.
//
//   npm run check:passwords
//
// Nửa dưới của tệp này mới là nửa khó. Một hàm `return "quá yếu"` cho mọi đầu
// vào sẽ qua sạch mọi trường hợp từ chối ở nửa trên, và khoá toàn bộ chủ nhà
// ra khỏi sản phẩm. Nên mỗi mật khẩu tốt ở dưới là một câu hỏi thật: luật này
// có đang từ chối thứ không đáng từ chối không.
//
// Đặc biệt "mypasswordisalongone" — nó chứa nguyên chữ "password" và vẫn phải
// được nhận, vì nó không phải "password" có đệm, nó là một câu.

import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_PERSONAL,
  PASSWORD_SEQUENTIAL,
  PASSWORD_TOO_COMMON,
  PASSWORD_TOO_PLAIN,
  PASSWORD_TOO_SHORT,
  passwordProblem,
} from "../.tmp/passwordRules.mjs";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const NGUOI = { email: "ngoc.mai@vidu.vn", name: "Trần Bảo Long" };

/* ------------------------------------------------------------------ */
console.log("\n-- ngắn quá");

check("dưới ngưỡng", passwordProblem("matkhau"), PASSWORD_TOO_SHORT);
check("đúng ngưỡng thì không phải vì ngắn",
      passwordProblem("a".repeat(MIN_PASSWORD_LENGTH)) === PASSWORD_TOO_SHORT, false);

/* ------------------------------------------------------------------ */
console.log("\n-- đủ dài nhưng rỗng ruột");

for (const p of ["aaaaaaaaaaaa", "121212121212", "0o0o0o0o0o0o", "!!!!!!!!!!!!"]) {
  check(`lặp: ${p}`, passwordProblem(p), PASSWORD_TOO_PLAIN);
}

/* ------------------------------------------------------------------ */
console.log("\n-- dãy liên tiếp");

for (const p of [
  "123456789012",   // chạy hết một chục rồi sang chục sau
  "qwertyuiopas",   // đi ngang bàn phím, vắt sang hàng dưới
  "abcdefghijkl",
  "mnbvcxzlkjhg",   // đi ngược
]) {
  check(`dãy: ${p}`, passwordProblem(p), PASSWORD_SEQUENTIAL);
}

/* ------------------------------------------------------------------ */
console.log("\n-- từ phổ biến, đệm cho đủ dài");

for (const p of [
  "password1234",
  "P@ssw0rd1234",    // thay chữ bằng số không tạo ra mật khẩu mới
  "matkhau123456",
  "iloveyou2026!",
  "2026iloveyou",    // đệm ở đầu cũng là đệm
  "anhyeuem2026",
  "welcome!!2026",
]) {
  check(`phổ biến: ${p}`, passwordProblem(p), PASSWORD_TOO_COMMON);
}

/* ------------------------------------------------------------------ */
console.log("\n-- tên chính sản phẩm này");

for (const p of ["tlshost2026!!", "AnBang-tlshost-9", "xX-TLSHost-Xx1"]) {
  check(`tên sản phẩm: ${p}`, passwordProblem(p), PASSWORD_TOO_COMMON);
}

/* ------------------------------------------------------------------ */
console.log("\n-- tên và email của chính người đó");

check("chứa phần đầu email", passwordProblem("ngocmai2026abcd", NGUOI), PASSWORD_PERSONAL);
check("chứa tên, có dấu", passwordProblem("baolong-2026-ab", NGUOI), PASSWORD_PERSONAL);
check("chứa tên, bỏ dấu", passwordProblem("TranBao-xanh-92", NGUOI), PASSWORD_PERSONAL);
check("không truyền ngữ cảnh thì luật này không chạy",
      passwordProblem("baolong-2026-ab"), null);

/* ------------------------------------------------------------------ */
console.log("\n-- và những mật khẩu tốt phải đi qua được");

// Nếu phần này hỏng thì luật đang khoá người dùng ra khỏi sản phẩm, và đó là
// hỏng nặng hơn mọi trường hợp ở trên.
const TOT = [
  "conmeotrenmaingoi",
  "xe dap mau xanh 2019",
  "mypasswordisalongone",     // chứa "password" mà vẫn là một câu
  "k7Qm2vRt9wLp",
  "quanlynhaanbang2026",      // chứa "quanly" mà vẫn là một câu
  "Trời hôm nay đẹp quá!",
  "buoi-sang-uong-ca-phe",
  "Nha7Phong-BienDong",
];

for (const p of TOT) check(`tốt: ${p}`, passwordProblem(p, NGUOI), null);
check("tất cả mật khẩu tốt đều qua",
      TOT.filter((p) => passwordProblem(p, NGUOI) === null).length, TOT.length);

/* ------------------------------------------------------------------ */
console.log(failures === 0 ? "\nall checks passed" : `\n${failures} lỗi`);
if (failures > 0) process.exitCode = 1;
