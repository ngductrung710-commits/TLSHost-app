/**
 * A QR encoder, byte mode, error correction level M.
 *
 * Written rather than installed. The project has no QR dependency and the one
 * string it needs to encode is a payment payload — pointing an <img> at
 * someone else's QR service would hand them every account number and amount
 * our users transfer, and adding a package for one function that has a fixed,
 * publicly specified answer is a poor trade in the other direction.
 *
 * "Publicly specified" is doing real work in that sentence. Nothing here is
 * invented: the block tables, the alignment centres and the two BCH codes are
 * from ISO/IEC 18004, and a single wrong number in any of them produces a
 * symbol that renders perfectly and decodes to nothing. That is why the check
 * file does not compare matrices against fixtures — it renders each version
 * and reads it back with a real decoder.
 *
 * Level M corrects around 15% of the symbol. A payment QR is scanned once,
 * from a screen, in whatever light the person happens to be in; L is thinner
 * than that deserves and Q would push the payload into a larger, denser
 * version for no benefit.
 */

/* -------------------------------------------------------------------------- */
/* GF(256)                                                                     */
/* -------------------------------------------------------------------------- */

/// Reed–Solomon works in the field with the primitive polynomial 0x11D, which
/// is the one the QR spec names. The tables are built rather than listed.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number) =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

/** The generator polynomial for `degree` error-correction codewords. */
function generator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]!;
      next[j + 1] ^= mul(poly[j]!, EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

/** Remainder of `data` divided by the generator — the EC codewords. */
function ecCodewords(data: Uint8Array, count: number): Uint8Array {
  const gen = generator(count);
  const out = new Uint8Array(count);
  for (const byte of data) {
    const factor = byte ^ out[0]!;
    out.copyWithin(0, 1);
    out[count - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < count; i++) out[i] ^= mul(gen[i + 1]!, factor);
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Version tables, level M                                                     */
/* -------------------------------------------------------------------------- */

/**
 * [EC codewords per block, blocks in group 1, data codewords each,
 *  blocks in group 2, data codewords each] — versions 1 to 20 at level M.
 *
 * Stops at 20 because the payload this encodes is a VietQR string of about
 * 150 characters, which fits version 8. Carrying the other twenty versions
 * would be twenty more rows nothing exercises, and an untested table is a
 * table that is wrong.
 */
const BLOCKS_M: readonly (readonly [number, number, number, number, number])[] = [
  [10, 1, 16, 0, 0],
  [16, 1, 28, 0, 0],
  [26, 1, 44, 0, 0],
  [18, 2, 32, 0, 0],
  [24, 2, 43, 0, 0],
  [16, 4, 27, 0, 0],
  [18, 4, 31, 0, 0],
  [22, 2, 38, 2, 39],
  [22, 3, 36, 2, 37],
  [26, 4, 43, 1, 44],
  [30, 1, 50, 4, 51],
  [22, 6, 36, 2, 37],
  [22, 8, 37, 1, 38],
  [24, 4, 40, 5, 41],
  [24, 5, 41, 5, 42],
  [28, 7, 45, 3, 46],
  [28, 10, 46, 1, 47],
  [26, 9, 43, 4, 44],
  [26, 3, 44, 11, 45],
  [26, 3, 41, 13, 42],
];

/** Centres of the alignment patterns, per version. */
const ALIGNMENT: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
  [6, 26, 50, 74],
  [6, 30, 54, 78],
  [6, 30, 56, 82],
  [6, 30, 58, 86],
  [6, 34, 62, 90],
];

const dataCapacity = (version: number): number => {
  const [, g1, d1, g2, d2] = BLOCKS_M[version - 1]!;
  return g1 * d1 + g2 * d2;
};

/** How many bits the character-count field takes, in byte mode. */
const countBits = (version: number) => (version <= 9 ? 8 : 16);

/* -------------------------------------------------------------------------- */
/* Bit assembly                                                                */
/* -------------------------------------------------------------------------- */

class Bits {
  private readonly bits: number[] = [];

  push(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }

  get length(): number {
    return this.bits.length;
  }

  toBytes(): Uint8Array {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((bit, i) => {
      if (bit) out[i >> 3]! |= 0x80 >> (i & 7);
    });
    return out;
  }
}

/**
 * Data codewords for `bytes`, at the smallest version that fits.
 *
 * Throws rather than truncating when nothing in the table is large enough. A
 * QR silently missing its last few characters is a payment memo silently
 * missing its reference.
 */
function encodeData(bytes: Uint8Array): { version: number; codewords: Uint8Array } {
  let version = 0;
  for (let v = 1; v <= BLOCKS_M.length; v++) {
    // 4 bits of mode, the character count, then the data itself.
    const needed = 4 + countBits(v) + bytes.length * 8;
    if (needed <= dataCapacity(v) * 8) {
      version = v;
      break;
    }
  }
  if (version === 0) {
    throw new Error(
      `${bytes.length} bytes does not fit any version up to ${BLOCKS_M.length} at level M.`,
    );
  }

  const capacity = dataCapacity(version) * 8;
  const bits = new Bits();
  bits.push(0b0100, 4); // byte mode
  bits.push(bytes.length, countBits(version));
  for (const byte of bytes) bits.push(byte, 8);

  // Terminator, up to four zero bits, then pad to a whole byte.
  bits.push(0, Math.min(4, capacity - bits.length));
  if (bits.length % 8 !== 0) bits.push(0, 8 - (bits.length % 8));

  const codewords = new Uint8Array(dataCapacity(version));
  codewords.set(bits.toBytes());
  // The spec's pad bytes, alternating, for whatever is left.
  for (let i = bits.length / 8; i < codewords.length; i++) {
    codewords[i] = i % 2 === (bits.length / 8) % 2 ? 0xec : 0x11;
  }
  return { version, codewords };
}

/**
 * Interleave the blocks, as the spec requires.
 *
 * Data is split into blocks, each gets its own EC codewords, and then both are
 * read out column-wise across the blocks. Writing them block after block
 * instead produces a symbol that scans on a clean screen and fails the moment
 * a smudge lands on one block — which is the failure that never shows up in
 * testing and always shows up in a café.
 */
function interleave(version: number, codewords: Uint8Array): Uint8Array {
  const [ecCount, g1, d1, g2, d2] = BLOCKS_M[version - 1]!;

  const blocks: { data: Uint8Array; ec: Uint8Array }[] = [];
  let at = 0;
  for (let i = 0; i < g1 + g2; i++) {
    const size = i < g1 ? d1 : d2;
    const data = codewords.slice(at, at + size);
    at += size;
    blocks.push({ data, ec: ecCodewords(data, ecCount) });
  }

  const out: number[] = [];
  const longest = Math.max(d1, d2);
  for (let i = 0; i < longest; i++) {
    for (const block of blocks) if (i < block.data.length) out.push(block.data[i]!);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const block of blocks) out.push(block.ec[i]!);
  }
  return new Uint8Array(out);
}

/* -------------------------------------------------------------------------- */
/* The symbol                                                                  */
/* -------------------------------------------------------------------------- */

type Grid = { size: number; on: Uint8Array; fixed: Uint8Array };

const idx = (g: Grid, x: number, y: number) => y * g.size + x;
const set = (g: Grid, x: number, y: number, on: boolean, fixed = true) => {
  g.on[idx(g, x, y)] = on ? 1 : 0;
  g.fixed[idx(g, x, y)] = fixed ? 1 : 0;
};

function placeFunctionPatterns(g: Grid, version: number): void {
  const finder = (ox: number, oy: number) => {
    for (let y = -1; y <= 7; y++) {
      for (let x = -1; x <= 7; x++) {
        const px = ox + x;
        const py = oy + y;
        if (px < 0 || py < 0 || px >= g.size || py >= g.size) continue;
        const inRing =
          (x >= 0 && x <= 6 && (y === 0 || y === 6)) ||
          (y >= 0 && y <= 6 && (x === 0 || x === 6));
        const inCore = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        set(g, px, py, inRing || inCore);
      }
    }
  };
  finder(0, 0);
  finder(g.size - 7, 0);
  finder(0, g.size - 7);

  // Timing patterns.
  for (let i = 8; i < g.size - 8; i++) {
    set(g, i, 6, i % 2 === 0);
    set(g, 6, i, i % 2 === 0);
  }

  // Alignment patterns, except where they would sit on a finder.
  const centres = ALIGNMENT[version - 1]!;
  for (const cy of centres) {
    for (const cx of centres) {
      const onFinder =
        (cx <= 8 && cy <= 8) ||
        (cx >= g.size - 9 && cy <= 8) ||
        (cx <= 8 && cy >= g.size - 9);
      if (onFinder) continue;
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          const edge = Math.max(Math.abs(x), Math.abs(y));
          set(g, cx + x, cy + y, edge !== 1);
        }
      }
    }
  }

  // The dark module, always on, always here.
  set(g, 8, g.size - 8, true);

  // Reserve the format areas so data does not land in them.
  for (let i = 0; i < 9; i++) {
    if (i !== 6) set(g, i, 8, false);
    if (i !== 6) set(g, 8, i, false);
  }
  for (let i = 0; i < 8; i++) {
    set(g, g.size - 1 - i, 8, false);
    if (i < 7) set(g, 8, g.size - 1 - i, false);
  }

  if (version >= 7) {
    // Version information, BCH(18,6) over the version number.
    let bits = version;
    for (let i = 0; i < 12; i++) {
      bits = (bits << 1) ^ (bits >> 11 ? 0x1f25 : 0);
    }
    const value = (version << 12) | bits;
    for (let i = 0; i < 18; i++) {
      const bit = ((value >> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = (i % 3) + g.size - 11;
      set(g, a, b, bit);
      set(g, b, a, bit);
    }
  }
}

/** Format information: level M is 0b00, then BCH(15,5), then the 0x5412 mask. */
function placeFormat(g: Grid, mask: number): void {
  const data = (0b00 << 3) | mask;
  let bits = data;
  for (let i = 0; i < 10; i++) bits = (bits << 1) ^ (bits >> 9 ? 0x537 : 0);
  const value = (((data << 10) | bits) ^ 0x5412) & 0x7fff;

  for (let i = 0; i < 15; i++) {
    const bit = ((value >> i) & 1) === 1;
    // Copy one: down the left edge and along the top, skipping the timing row.
    if (i < 6) set(g, 8, i, bit);
    else if (i < 8) set(g, 8, i + 1, bit);
    else if (i === 8) set(g, 7, 8, bit);
    else set(g, 14 - i, 8, bit);

    // Copy two: the spec puts a second copy elsewhere, so a damaged corner
    // does not cost the reader the mask number.
    if (i < 8) set(g, g.size - 1 - i, 8, bit);
    else set(g, 8, g.size - 15 + i, bit);
  }
}

const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Lay the codewords out in the zigzag the spec describes, applying the mask. */
function placeData(g: Grid, bytes: Uint8Array, mask: number): void {
  const maskFn = MASKS[mask]!;
  let bit = 0;
  let upward = true;

  for (let right = g.size - 1; right >= 1; right -= 2) {
    // Column 6 is the vertical timing pattern and is skipped entirely.
    const col = right <= 6 ? right - 1 : right;
    for (let i = 0; i < g.size; i++) {
      const y = upward ? g.size - 1 - i : i;
      for (const x of [col, col - 1]) {
        if (g.fixed[idx(g, x, y)]) continue;
        const byte = bytes[bit >> 3] ?? 0;
        const on = ((byte >> (7 - (bit & 7))) & 1) === 1;
        g.on[idx(g, x, y)] = (on !== maskFn(x, y) ? 1 : 0) as number;
        bit++;
      }
    }
    upward = !upward;
  }
}

/** The spec's four penalty rules, used to pick the least ugly mask. */
function penalty(g: Grid): number {
  const at = (x: number, y: number) => g.on[idx(g, x, y)] === 1;
  let score = 0;

  // Rule 1: runs of five or more.
  for (let i = 0; i < g.size; i++) {
    for (const horizontal of [true, false]) {
      let run = 1;
      for (let j = 1; j < g.size; j++) {
        const a = horizontal ? at(j, i) : at(i, j);
        const b = horizontal ? at(j - 1, i) : at(i, j - 1);
        if (a === b) run++;
        else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }
  }

  // Rule 2: 2x2 blocks of one colour.
  for (let y = 0; y < g.size - 1; y++) {
    for (let x = 0; x < g.size - 1; x++) {
      const v = at(x, y);
      if (v === at(x + 1, y) && v === at(x, y + 1) && v === at(x + 1, y + 1)) score += 3;
    }
  }

  // Rule 3: the finder-like 1:1:3:1:1 pattern with four light modules beside it.
  const patterns = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true],
  ];
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      for (const p of patterns) {
        if (x + p.length <= g.size && p.every((v, k) => at(x + k, y) === v)) score += 40;
        if (y + p.length <= g.size && p.every((v, k) => at(x, y + k) === v)) score += 40;
      }
    }
  }

  // Rule 4: how far the dark proportion strays from half.
  let dark = 0;
  for (let i = 0; i < g.on.length; i++) if (g.on[i]) dark++;
  const percent = (dark * 100) / (g.size * g.size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

/**
 * Encode `text` and return the module matrix — true is a dark module.
 *
 * No quiet zone. The caller draws that, because how much margin a QR needs is
 * a question about the surface it is printed on, not about the symbol.
 */
export function qrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const { version, codewords } = encodeData(bytes);
  const final = interleave(version, codewords);
  const size = 17 + version * 4;

  let best: Grid | null = null;
  let bestScore = Infinity;

  for (let mask = 0; mask < 8; mask++) {
    const g: Grid = {
      size,
      on: new Uint8Array(size * size),
      fixed: new Uint8Array(size * size),
    };
    placeFunctionPatterns(g, version);
    placeData(g, final, mask);
    placeFormat(g, mask);
    const score = penalty(g);
    if (score < bestScore) {
      bestScore = score;
      best = g;
    }
  }

  const g = best!;
  const out: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(g.on[idx(g, x, y)] === 1);
    out.push(row);
  }
  return out;
}

/**
 * The matrix as one SVG path's `d` attribute, one `M…h1v1h-1z` per module.
 *
 * A path rather than a rect per module: a version-8 symbol is 2,209 modules,
 * and half of them as separate elements is a DOM the browser has to lay out.
 * One path draws in a single node and scales to any size without blurring,
 * which a raster of a QR does not.
 */
export function qrPath(matrix: boolean[][]): string {
  let d = "";
  matrix.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  return d;
}
