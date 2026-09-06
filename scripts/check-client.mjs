/**
 * Không "use client" nào được kéo một module server-only vào gói trình duyệt.
 *
 * Vì sao có tệp này: ResetForm.tsx nhập MIN_PASSWORD_LENGTH từ src/lib/passwords.ts,
 * mà tệp đó mở đầu bằng `import "server-only"` để chặn Argon2 lọt xuống trình duyệt.
 * Kết quả là trang /dat-lai-mat-khau/[token] lỗi build — nhưng `tsc`, `lint` và
 * toàn bộ `npm run check` vẫn xanh, vì không thứ nào trong đó dựng gói client.
 * Lỗi chỉ hiện khi mở trang bằng trình duyệt.
 *
 * Kiểm tra này đi theo đồ thị nhập của mọi tệp "use client" và báo hỏng nếu
 * chạm tới một tệp server-only. Nhập kiểu (`import type`) bị bỏ qua: nó bị xoá
 * lúc biên dịch nên không nằm trong gói.
 *
 * Nó KHÔNG thay cho việc mở trang: nó chỉ thấy lớp lỗi này, không thấy lỗi
 * dựng nào khác.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const read = (p) => readFileSync(p, "utf8");

/** Đường dẫn tương đối hoặc "@/..." → tệp thật, hoặc null nếu là gói npm. */
function resolveImport(spec, from) {
  let base;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  else return null;

  const stripped = base.replace(/\.js$/, "");
  for (const cand of [
    base,
    ...[".ts", ".tsx", ".js", ".jsx"].flatMap((e) => [stripped + e, base + e]),
    ...[".ts", ".tsx", ".js", ".jsx"].map((e) => join(base, "index" + e)),
  ]) {
    try {
      if (statSync(cand).isFile()) return cand;
    } catch {}
  }
  return null;
}

/** Mọi đích nhập có sinh mã, đã bỏ `import type`. */
function valueImports(src) {
  const out = [];
  const re = /(^|\n)\s*(?:import|export)\s+([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  for (const m of src.matchAll(re)) {
    const clause = m[2];
    if (/^type\b/.test(clause)) continue; // import type { X } from …
    out.push(m[3]);
  }
  // import "…" trần cũng kéo module vào gói
  for (const m of src.matchAll(/(^|\n)\s*import\s+["']([^"']+)["']/g)) out.push(m[2]);
  return out;
}

const isServerOnly = (src) => /^\s*import\s+["']server-only["']/m.test(src);
const isClient = (src) => /^\s*["']use client["']/.test(src.replace(/^\uFEFF/, ""));

const entries = files.filter((f) => isClient(read(f)));
const failures = [];

for (const entry of entries) {
  const seen = new Set([entry]);
  const queue = [[entry, [entry]]];
  while (queue.length) {
    const [file, path] = queue.shift();
    const src = read(file);
    if (file !== entry && isServerOnly(src)) {
      failures.push(path.map((p) => relative(ROOT, p).split(String.fromCharCode(92)).join("/")));
      break;
    }
    for (const spec of valueImports(src)) {
      const next = resolveImport(spec, file);
      if (next && !seen.has(next)) {
        seen.add(next);
        queue.push([next, [...path, next]]);
      }
    }
  }
}

console.log(`-- không "use client" nào chạm module server-only`);
if (failures.length === 0) {
  console.log(`PASS  ${entries.length} tệp client, không tệp nào\n`);
  console.log("all checks passed");
} else {
  for (const chain of failures) console.log(`FAIL  ${chain.join("\n        → ")}`);
  console.log(`\n${failures.length} lỗi`);
  process.exitCode = 1;
}
