// Cuts the mark out of the full lockup, dropping the wordmark beside it.
//
//   node scripts/crop-mark.mjs <path-to-full-logo.png>
//
// Writes public/logo.png. Run scripts/make-icons.mjs afterwards.
//
// The crop is measured, not eyeballed. A logo cropped by hand is a logo with
// the mark two pixels off centre, which is invisible in the file and obvious
// once it sits in a 36px frame beside a wordmark.
//
// How it finds the mark: the plate is one flat colour, so every pixel that is
// not that colour is ink. Counting ink per column gives runs — the mark, a gap,
// then the letters. The leftmost run is the mark. That holds for this lockup;
// it would not hold for one with the text on the left, and the script says so
// rather than guessing.

import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/crop-mark.mjs <path-to-full-logo.png>");
  process.exit(1);
}

/* -------------------------------------------------------------------- */

function decode(buf) {
  let at = 8;
  let ihdr = null;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at);
    const type = buf.toString("ascii", at + 4, at + 8);
    const data = buf.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") {
      ihdr = {
        w: data.readUInt32BE(0),
        h: data.readUInt32BE(4),
        depth: data[8],
        colour: data[9],
        interlace: data[12],
      };
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + len;
  }

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[ihdr.colour];
  if (ihdr.depth !== 8 || !channels || ihdr.interlace !== 0) {
    throw new Error(`unsupported PNG: ${JSON.stringify(ihdr)}`);
  }

  const raw = inflateSync(Buffer.concat(idat));
  const { w, h } = ihdr;
  const stride = w * channels;
  const flat = Buffer.alloc(h * stride);

  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? flat[y * stride + i - channels] : 0;
      const b = y > 0 ? flat[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= channels ? flat[(y - 1) * stride + i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      flat[y * stride + i] = v & 0xff;
    }
  }

  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0, j = 0; i < w * h; i++, j += 3) {
    const s = i * channels;
    if (channels >= 3) {
      rgb[j] = flat[s]; rgb[j + 1] = flat[s + 1]; rgb[j + 2] = flat[s + 2];
    } else {
      rgb[j] = rgb[j + 1] = rgb[j + 2] = flat[s];
    }
  }
  return { w, h, rgb };
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let c = 0xffffffff;
  for (const byte of body) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function encode(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(img.h * (img.w * 3 + 1));
  for (let y = 0; y < img.h; y++) {
    raw[y * (img.w * 3 + 1)] = 0;
    img.rgb.copy(raw, y * (img.w * 3 + 1) + 1, y * img.w * 3, (y + 1) * img.w * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------------- */

const img = decode(readFileSync(source));
const px = (x, y) => {
  const i = (y * img.w + x) * 3;
  return [img.rgb[i], img.rgb[i + 1], img.rgb[i + 2]];
};

// The plate colour, taken from the corner rather than from a histogram: the
// corner is background by construction, and a histogram would tie on a lockup
// that happened to be half ink.
const [br, bg, bb] = px(0, 0);
const isInk = (x, y) => {
  const [r, g, b] = px(x, y);
  return Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) > 60;
};

const inkInColumn = [];
for (let x = 0; x < img.w; x++) {
  let n = 0;
  for (let y = 0; y < img.h; y++) if (isInk(x, y)) n++;
  inkInColumn.push(n);
}

// Runs of columns that carry ink, separated by clear gaps.
const runs = [];
let start = null;
for (let x = 0; x <= img.w; x++) {
  const has = x < img.w && inkInColumn[x] > 0;
  if (has && start === null) start = x;
  if (!has && start !== null) {
    runs.push([start, x - 1]);
    start = null;
  }
}

if (runs.length === 0) throw new Error("no ink found — is the background flat?");
if (runs.length === 1) {
  console.log("only one ink region: this looks like the mark on its own already.");
}

const [x0, x1] = runs[0];
if (runs.length > 1) {
  const [t0] = runs[1];
  console.log(
    `mark occupies columns ${x0}–${x1}; the next region starts at ${t0}, ` +
      `so ${runs.length - 1} region(s) to its right are being dropped.`,
  );
}

// Vertical extent of the mark alone, not of the whole lockup.
let y0 = img.h, y1 = 0;
for (let x = x0; x <= x1; x++) {
  for (let y = 0; y < img.h; y++) {
    if (!isInk(x, y)) continue;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
}

// A square around the mark's centre, with room to breathe. 1.28 keeps roughly
// the framing the earlier hand-cropped file had, so swapping this in does not
// visibly resize the logo in the rail.
const markW = x1 - x0 + 1;
const markH = y1 - y0 + 1;
const side = Math.round(Math.max(markW, markH) * 1.28);
const cx = Math.round((x0 + x1) / 2);
const cy = Math.round((y0 + y1) / 2);

const left = cx - (side >> 1);
const top = cy - (side >> 1);

const out = Buffer.alloc(side * side * 3);
for (let y = 0; y < side; y++) {
  for (let x = 0; x < side; x++) {
    const sx = left + x;
    const sy = top + y;
    const o = (y * side + x) * 3;
    // Outside the source, fall back to the plate colour rather than black.
    if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) {
      out[o] = br; out[o + 1] = bg; out[o + 2] = bb;
      continue;
    }
    const s = (sy * img.w + sx) * 3;
    out[o] = img.rgb[s];
    out[o + 1] = img.rgb[s + 1];
    out[o + 2] = img.rgb[s + 2];
  }
}

writeFileSync("public/logo.png", encode({ w: side, h: side, rgb: out }));

console.log(`source ${img.w}x${img.h}, plate #${[br, bg, bb].map((v) => v.toString(16).padStart(2, "0")).join("")}`);
console.log(`mark ${markW}x${markH} at (${x0},${y0})`);
console.log(`wrote public/logo.png at ${side}x${side}`);
console.log(`\nnext: node scripts/make-icons.mjs`);
