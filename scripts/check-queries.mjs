// Truy vấn song song bên trong một giao dịch.
//
//   npm run check:queries
//
// Một giao dịch giữ đúng một kết nối, nên hai truy vấn trong đó không bao giờ
// chạy song song thật. `pg` xếp hàng chúng rồi cảnh báo — và ở pg@9 nó sẽ ném
// lỗi thay vì cảnh báo. Nghĩa là `Promise.all` quanh vài lời gọi `tx.` không
// mua được gì cả, và sẽ hỏng.
//
// File này tồn tại vì lỗi đó đã tái phát. Nó được phát hiện và sửa ở
// src/lib/availability.ts, kèm một đoạn ghi chú giải thích đầy đủ lý do — rồi
// vẫn xuất hiện lại ở src/lib/dashboard.ts và src/lib/sales.ts. Một dòng ghi
// chú dạy được người đọc nó; nó không chặn được người không đọc.
//
// Luật ở đây hẹp có chủ ý: chỉ soi phần thân của `Promise.all(...)`, và chỉ
// kêu khi bên trong có `tx.`.
//
// VÀ NÓ KHÔNG PHẢI TẤT CẢ. Có một nguyên nhân thứ hai mà file này không nhìn
// thấy được, tìm ra ngày 06/09/2026: một quan hệ MỘT-NHIỀU đứng chung select
// với các quan hệ một-một. Prisma bung chúng thành nhiều truy vấn và phát
// đúng cảnh báo này, dù mọi dòng trong code đều có await và không có
// Promise.all nào. Đo cụ thể trên membership: `org` + `user` im lặng,
// `scopes` một mình im lặng, cả ba cùng lúc thì kêu, tách `scopes` ra một
// truy vấn tuần tự thì im lại — xem src/lib/dal.ts.
//
// Dạng đó không dò được bằng cách đọc chữ mà không dựng lại lược đồ, nên nó
// được ghi ở đây thay vì được canh. Suite này xanh KHÔNG có nghĩa là không
// còn cảnh báo pg; nó chỉ có nghĩa là không ai bọc truy vấn trong
// Promise.all. Cách tìm nguyên nhân kia là khởi động nguội, chạm đúng một
// đường, và đếm — cảnh báo của Node chỉ phát một lần mỗi vị trí gọi mỗi
// tiến trình, nên đo lặp lại trên cùng tiến trình luôn cho số 0.
//
// `Promise.all` bọc các lời gọi mạng — như src/lib/push.ts gửi thông báo đẩy
// — là song song thật và không bị đụng tới.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = ["src/lib", "src/app"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Phần trong ngoặc của `Promise.all(` bắt đầu ở `open`, cân bằng ngoặc. */
function body(code, open) {
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return code.slice(open, i + 1);
    }
  }
  return code.slice(open);
}

let failures = 0;
let scanned = 0;

console.log("-- không có Promise.all nào bọc truy vấn trong một giao dịch");

for (const file of ROOTS.flatMap((r) => walk(r))) {
  const code = readFileSync(file, "utf8");
  scanned += 1;
  for (const m of code.matchAll(/Promise\.all\s*\(/g)) {
    const inner = body(code, m.index + m[0].length - 1);
    // `tx.` là tên tham số mà withOrg/withSetting trao cho callback ở khắp
    // codebase. Một quy ước, không phải một đảm bảo — nên luật này bắt được
    // cách viết thường gặp, không phải mọi cách viết có thể có.
    if (!/\btx\./.test(inner)) continue;
    failures += 1;
    const line = code.slice(0, m.index).split("\n").length;
    console.log(`FAIL  ${file}:${line}`);
    console.log("      Promise.all bọc lời gọi tx. — chuyển sang tuần tự");
  }
}

if (failures === 0) console.log(`PASS  ${scanned} tệp, không tệp nào`);

console.log("");
if (failures === 0) {
  console.log("all checks passed");
} else {
  console.log(`${failures} FAILED`);
  process.exit(1);
}
