// Builds the PWA icons from public/logo.png.
//
//   node scripts/make-icons.mjs
//
// Written rather than pulled in because the whole job is: decode one PNG,
// resample it twice, encode two PNGs. An image library is thirty megabytes of
// node_modules and a native build step for that.
//
// The source is a square-ish plate with a mark on it, so the resampling is a
// plain box filter — area-average going down, bilinear going up. There is no
// alpha to preserve and no colour management to get wrong.
//
// It is a script and not a build step on purpose: the icons change when the
// artwork changes, which is roughly never, and a home-screen icon that gets
// regenerated on every deploy is a home-screen icon that can change by
// accident.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";

/* -------------------------------------------------------------------- */
/* decode                                                               */

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
  const out = Buffer.alloc(h * stride);

  // Undo the per-scanline filter, PNG spec 9.2.
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[y * stride + i - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = y > 0 && i >= channels ? out[(y - 1) * stride + i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + i] = v & 0xff;
    }
  }

  // Normalise to RGB, dropping alpha over the plate colour if there is any.
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0, j = 0; i < w * h; i++, j += 3) {
    const s = i * channels;
    if (channels >= 3) {
      rgb[j] = out[s];
      rgb[j + 1] = out[s + 1];
      rgb[j + 2] = out[s + 2];
    } else {
      rgb[j] = rgb[j + 1] = rgb[j + 2] = out[s];
    }
  }
  return { w, h, rgb };
}

/* -------------------------------------------------------------------- */
/* resample                                                             */

/** Largest centred square, so a 255×250 plate loses only background. */
function crop(img) {
  const side = Math.min(img.w, img.h);
  const x0 = (img.w - side) >> 1;
  const y0 = (img.h - side) >> 1;
  const out = Buffer.alloc(side * side * 3);
  for (let y = 0; y < side; y++) {
    img.rgb.copy(
      out,
      y * side * 3,
      ((y + y0) * img.w + x0) * 3,
      ((y + y0) * img.w + x0 + side) * 3,
    );
  }
  return { w: side, h: side, rgb: out };
}

/**
 * Area-average when shrinking, bilinear when growing.
 *
 * Nearest-neighbour would be one line shorter and would put stair-steps on
 * every curve of the mark, which is the one thing a logo cannot have.
 */
function resample(img, size) {
  const out = Buffer.alloc(size * size * 3);
  const scale = img.w / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 3;

      if (scale >= 1) {
        const x0 = Math.floor(x * scale), x1 = Math.min(img.w, Math.ceil((x + 1) * scale));
        const y0 = Math.floor(y * scale), y1 = Math.min(img.h, Math.ceil((y + 1) * scale));
        let r = 0, g = 0, b = 0, n = 0;
        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) {
            const s = (sy * img.w + sx) * 3;
            r += img.rgb[s]; g += img.rgb[s + 1]; b += img.rgb[s + 2]; n++;
          }
        }
        out[o] = Math.round(r / n);
        out[o + 1] = Math.round(g / n);
        out[o + 2] = Math.round(b / n);
      } else {
        const fx = (x + 0.5) * scale - 0.5, fy = (y + 0.5) * scale - 0.5;
        const x0 = Math.max(0, Math.floor(fx)), y0 = Math.max(0, Math.floor(fy));
        const x1 = Math.min(img.w - 1, x0 + 1), y1 = Math.min(img.h - 1, y0 + 1);
        const tx = fx - x0, ty = fy - y0;
        for (let c = 0; c < 3; c++) {
          const p00 = img.rgb[(y0 * img.w + x0) * 3 + c];
          const p10 = img.rgb[(y0 * img.w + x1) * 3 + c];
          const p01 = img.rgb[(y1 * img.w + x0) * 3 + c];
          const p11 = img.rgb[(y1 * img.w + x1) * 3 + c];
          const top = p00 + (p10 - p00) * tx;
          const bottom = p01 + (p11 - p01) * tx;
          out[o + c] = Math.round(top + (bottom - top) * ty);
        }
      }
    }
  }
  return { w: size, h: size, rgb: out };
}

/* -------------------------------------------------------------------- */
/* encode                                                               */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encode(img) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour, no alpha
  // Filter 0 on every scanline: the plate is flat and the mark is smooth, so
  // the cleverer filters buy a few percent on a file this small.
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

const source = decode(readFileSync("public/logo.png"));
const square = crop(source);

for (const size of [192, 512]) {
  const file = `public/icon-${size}.png`;
  const png = encode(resample(square, size));
  writeFileSync(file, png);
  const ratio = size / square.w;
  console.log(
    `${file}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} kB  ` +
      (ratio <= 1
        ? `from ${square.w}px, downscaled — sharp`
        : `from ${square.w}px, UPSCALED ${ratio.toFixed(1)}x — soft, wants a real export`),
  );
}

console.log(`\nsource ${source.w}x${source.h}, squared to ${square.w}px`);
console.log(`sha of logo.png: ${createHash("sha256").update(readFileSync("public/logo.png")).digest("hex").slice(0, 12)}`);
