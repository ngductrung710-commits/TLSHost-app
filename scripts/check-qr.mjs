// The QR encoder, read back by somebody else's decoder.
//
//   npm run check:qr
//
// The point of this file is that it does not trust the encoder's own idea of
// what it produced. Every symbol is rendered to a pixel buffer and handed to
// jsQR — an unrelated implementation, a devDependency that never ships — and
// the test is whether the text comes back. Comparing a matrix against a
// fixture I generated would pass just as happily with the block table wrong.
//
// Every version from 1 to 20 is exercised, because the tables are per-version
// and a single wrong number is invisible until a payload happens to be that
// long. Versions 1 to 9 use an 8-bit character count and 10 upward use 16, so
// the boundary at 9/10 is a real edge and both sides of it are covered.

import jsQR from "jsqr";

import { qrMatrix, qrPath } from "../.tmp/qr.mjs";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

/**
 * Render a matrix the way a scanner sees one: black modules on white, with the
 * four-module quiet zone the spec requires. Without the quiet zone a decoder
 * cannot find the symbol's edge, and every one of these would "fail" for a
 * reason that has nothing to do with the encoder.
 */
function render(matrix, scale = 4, quiet = 4) {
  const modules = matrix.length;
  const size = (modules + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (!matrix[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = (x + quiet) * scale + dx;
          const py = (y + quiet) * scale + dy;
          const at = (py * size + px) * 4;
          data[at] = data[at + 1] = data[at + 2] = 0;
        }
      }
    }
  }
  return { data, size };
}

const roundTrip = (text) => {
  const matrix = qrMatrix(text);
  const { data, size } = render(matrix);
  const found = jsQR(data, size, size);
  return { decoded: found?.data ?? null, modules: matrix.length };
};

/* -------------------------------------------------------------------- */
console.log("-- a real decoder reads back what went in");

const vietqrish =
  "00020101021238570010A00000072701270006970436011012345678900208QRIBFTTA53037045405690000" +
  "5802VN62140810TLSABC1236304";
const r = roundTrip(vietqrish);
check("a VietQR-shaped payload survives", r.decoded, vietqrish);
check("…and lands in a version the tables cover", r.modules <= 17 + 20 * 4, true);

check("one character", roundTrip("A").decoded, "A");
check("the digits", roundTrip("0123456789").decoded, "0123456789");
check("UTF-8 is carried as bytes", roundTrip("Chuyển khoản").decoded, "Chuyển khoản");

/* -------------------------------------------------------------------- */
console.log("\n-- every version in the table, decoded");

// Grow the payload until each version is reached, and check the one that comes
// out. A wrong row in BLOCKS_M only shows up at the length that selects it.
const seen = new Map();
for (let length = 1; length <= 640; length++) {
  const text = "A".repeat(length);
  let matrix;
  try {
    matrix = qrMatrix(text);
  } catch {
    break; // past the end of the table, which is its own test below
  }
  const version = (matrix.length - 17) / 4;
  if (seen.has(version)) continue;
  const { data, size } = render(matrix);
  seen.set(version, jsQR(data, size, size)?.data === text);
}

const versions = [...seen.keys()].sort((a, b) => a - b);
check("versions 1 through 20 are all reachable", versions, Array.from({ length: 20 }, (_, i) => i + 1));
const broken = versions.filter((v) => !seen.get(v));
check("every one of them decodes", broken, []);

/* -------------------------------------------------------------------- */
console.log("\n-- the 9/10 boundary, where the count field changes width");

// Version 9 counts characters in 8 bits, version 10 in 16. Getting this wrong
// shifts every data bit by eight and the symbol decodes to nothing.
for (const version of [9, 10]) {
  const length = [...Array(640).keys()]
    .map((i) => i + 1)
    .find((n) => {
      try { return (qrMatrix("A".repeat(n)).length - 17) / 4 === version; }
      catch { return false; }
    });
  const text = "B".repeat(length);
  const { data, size } = render(qrMatrix(text));
  check(`version ${version} at its smallest payload`, jsQR(data, size, size)?.data, text);
}

/* -------------------------------------------------------------------- */
console.log("\n-- refusing is better than truncating");

let threw = false;
try { qrMatrix("A".repeat(5000)); } catch { threw = true; }
check("too much data throws rather than dropping the tail", threw, true);

/* -------------------------------------------------------------------- */
console.log("\n-- the SVG path draws the same modules");

const matrix = qrMatrix("TLSHOST");
const path = qrPath(matrix);
const dark = matrix.flat().filter(Boolean).length;
check("one subpath per dark module", path.split("M").length - 1, dark);
check("nothing drawn outside the matrix", /M(\d+) (\d+)h/.test(path) && path.match(/M(\d+) (\d+)h/g).every((m) => {
  const [, x, y] = m.match(/M(\d+) (\d+)h/);
  return Number(x) < matrix.length && Number(y) < matrix.length;
}), true);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
