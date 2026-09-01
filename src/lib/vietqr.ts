/**
 * The VietQR payload a banking app scans.
 *
 * VietQR is Napas' profile of the EMVCo merchant-presented QR spec, and the
 * payload is a flat string of tag-length-value fields: a two-digit tag, a
 * two-digit length, then exactly that many characters. Some values are
 * themselves TLV, nested to two levels. It ends with a CRC over everything
 * before it, including the CRC field's own tag and length.
 *
 * Written out here rather than fetched from an image service. A payment screen
 * that depends on a third party is a payment screen that goes down when they
 * do, and pointing an <img> at someone else's host also tells them the amount,
 * the account number and the memo of every transfer our users make.
 *
 * The lengths are computed, never written by hand. Every mistake this format
 * admits is a length that disagrees with its value by one, and the result is
 * not an error — it is a QR that scans into nonsense, or into a *different
 * account number*, which is the one bug here that costs somebody money.
 */

/** Tags this file writes. The spec has many more; these are the ones VietQR needs. */
const TAG = {
  VERSION: "00",
  INIT_METHOD: "01",
  MERCHANT_INFO: "38",
  CATEGORY: "52",
  CURRENCY: "53",
  AMOUNT: "54",
  COUNTRY: "58",
  ADDITIONAL: "62",
  CRC: "63",
} as const;

/** Napas' identifier, and the sub-tags inside tag 38. */
const NAPAS_AID = "A000000727";
const SUB = {
  GUID: "00",
  BENEFICIARY: "01",
  SERVICE: "02",
  ACQUIRER: "00",
  ACCOUNT: "01",
  PURPOSE: "08",
} as const;

/** 704 is Vietnam; 704 is also the ISO 4217 number for the dong. */
const COUNTRY = "VN";
const CURRENCY_VND = "704";

/** Transfer to an account, as opposed to a card. */
const SERVICE_TRANSFER = "QRIBFTTA";

/**
 * One tag-length-value field.
 *
 * Length is the character count, two digits, zero-padded. A value long enough
 * to need three digits cannot be expressed, and silently truncating the length
 * to "99" would produce a payload that parses as far as the wrong place — so
 * it throws instead.
 */
function tlv(tag: string, value: string): string {
  if (value.length > 99) {
    throw new Error(`VietQR field ${tag} is ${value.length} characters; the format allows 99.`);
  }
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

/**
 * CRC-16/CCITT-FALSE over the payload, as the spec requires.
 *
 * Polynomial 0x1021, initial value 0xFFFF, no reflection, no final xor. Four
 * uppercase hex digits. Every other CRC-16 variant produces a plausible-
 * looking four-character string that no banking app accepts, which is why the
 * check file pins this against a published example rather than against itself.
 */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/**
 * The memo, reduced to what a bank will carry.
 *
 * Vietnamese banks reject diacritics and most punctuation in a transfer
 * description, and different ones reject different things. Rather than find
 * out per bank, the memo is stripped to letters, digits and spaces — which the
 * reference already is, so in practice this only guards against someone adding
 * a friendlier note later.
 */
export function sanitiseMemo(memo: string): string {
  return memo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, 25);
}

export type VietQrInput = {
  /** Napas bank id — 6 digits, e.g. "970436" for Vietcombank. */
  bankBin: string;
  accountNumber: string;
  /** Whole dong. Omit for a QR the payer types the amount into. */
  amount?: number;
  /** Transfer memo. Ours is the purchase reference. */
  memo?: string;
};

/**
 * Build the payload string. Feed it to a QR encoder; it is not itself an image.
 */
export function vietQrPayload({
  bankBin,
  accountNumber,
  amount,
  memo,
}: VietQrInput): string {
  if (!/^\d{6}$/.test(bankBin)) {
    throw new Error(`Bank BIN must be six digits, got ${JSON.stringify(bankBin)}.`);
  }
  if (!/^\d{4,19}$/.test(accountNumber)) {
    throw new Error("Account number must be 4–19 digits.");
  }
  if (amount !== undefined && (!Number.isInteger(amount) || amount <= 0)) {
    throw new Error("Amount must be a positive whole number of dong.");
  }

  const beneficiary =
    tlv(SUB.ACQUIRER, bankBin) + tlv(SUB.ACCOUNT, accountNumber);

  const merchant =
    tlv(SUB.GUID, NAPAS_AID) +
    tlv(SUB.BENEFICIARY, beneficiary) +
    tlv(SUB.SERVICE, SERVICE_TRANSFER);

  let payload =
    tlv(TAG.VERSION, "01") +
    // "12" is dynamic: this QR carries an amount and is good for one payment.
    // "11" would be a static QR the payer reuses, which is the wrong thing
    // when the memo identifies a single purchase.
    tlv(TAG.INIT_METHOD, amount === undefined ? "11" : "12") +
    tlv(TAG.MERCHANT_INFO, merchant) +
    tlv(TAG.CURRENCY, CURRENCY_VND);

  if (amount !== undefined) payload += tlv(TAG.AMOUNT, String(amount));

  payload += tlv(TAG.COUNTRY, COUNTRY);

  const clean = memo === undefined ? "" : sanitiseMemo(memo);
  if (clean !== "") {
    payload += tlv(TAG.ADDITIONAL, tlv(SUB.PURPOSE, clean));
  }

  // The CRC covers the tag and the length of the CRC field itself, which is
  // why "6304" is appended before the checksum is taken.
  const withCrcHeader = `${payload}${TAG.CRC}04`;
  return withCrcHeader + crc16(withCrcHeader);
}

/**
 * Read a payload back into its fields.
 *
 * Here so the check file can assert on structure rather than on one long
 * string — a test that compares against a literal passes just as happily when
 * both sides are wrong in the same way, and says nothing about which field
 * moved.
 */
export function parseTlv(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  let at = 0;
  while (at + 4 <= input.length) {
    const tag = input.slice(at, at + 2);
    const length = Number(input.slice(at + 2, at + 4));
    if (!Number.isInteger(length)) throw new Error(`Bad length at ${at}.`);
    const value = input.slice(at + 4, at + 4 + length);
    if (value.length !== length) {
      throw new Error(`Field ${tag} says ${length} characters but only ${value.length} follow.`);
    }
    out[tag] = value;
    at += 4 + length;
  }
  if (at !== input.length) throw new Error("Trailing bytes after the last field.");
  return out;
}

/** True when the payload's own CRC matches what it should be. */
export function crcIsValid(payload: string): boolean {
  if (payload.length < 8) return false;
  const body = payload.slice(0, -4);
  const found = payload.slice(-4);
  return body.endsWith(`${TAG.CRC}04`) && crc16(body) === found.toUpperCase();
}
