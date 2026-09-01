// The VietQR payload, field by field.
//
//   npm run check:vietqr
//
// Two different kinds of claim live here, and they are not equally strong.
//
// The CRC is pinned against the standard CRC-16/CCITT-FALSE vector, which is
// external truth: "123456789" checksums to 29B1 in every published table. If
// that line passes, the checksum is the one the spec asks for.
//
// The field layout is checked by parsing the payload back and asserting on
// structure. That catches every length that disagrees with its value — the
// only failure mode this format really has — but it cannot prove the tags are
// the ones Napas wants, because both sides of the test are this repository.
// The decisive test for that is a banking app scanning it, and no script here
// can stand in for one.

import {
  crc16,
  crcIsValid,
  parseTlv,
  sanitiseMemo,
  vietQrPayload,
} from "../.tmp/vietqr.mjs";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};
const throws = (label, fn) => {
  let threw = false;
  try { fn(); } catch { threw = true; }
  check(label, threw, true);
};

/* -------------------------------------------------------------------- */
console.log("-- CRC-16/CCITT-FALSE, against the published vector");

check('"123456789" checksums to 29B1', crc16("123456789"), "29B1");
check("empty input is FFFF", crc16(""), "FFFF");
// The variants that would be wrong here all produce four plausible hex digits:
// CRC-16/XMODEM would say 31C3, CRC-16/ARC would say BB3D. Neither is an error
// anywhere in this codebase — only a QR no bank accepts.
check("not XMODEM", crc16("123456789") === "31C3", false);
check("not ARC", crc16("123456789") === "BB3D", false);

/* -------------------------------------------------------------------- */
console.log("\n-- the payload parses back into the fields it claims");

const payload = vietQrPayload({
  bankBin: "970436",
  accountNumber: "1234567890",
  amount: 690_000,
  memo: "TLS ABC123",
});

const top = parseTlv(payload);
check("version", top["00"], "01");
check("dynamic QR because it carries an amount", top["01"], "12");
check("currency is the dong", top["53"], "704");
check("amount is whole dong, no decimals", top["54"], "690000");
check("country", top["58"], "VN");

const merchant = parseTlv(top["38"]);
check("Napas AID", merchant["00"], "A000000727");
check("service is account transfer", merchant["02"], "QRIBFTTA");

const beneficiary = parseTlv(merchant["01"]);
check("bank BIN survives nesting", beneficiary["00"], "970436");
check("account number survives nesting", beneficiary["01"], "1234567890");

const additional = parseTlv(top["62"]);
check("memo is carried in tag 08", additional["08"], "TLS ABC123");

/* -------------------------------------------------------------------- */
console.log("\n-- every length agrees with its value");

// parseTlv throws on the first field whose length lies, and refuses to stop
// short of the end. Both matter: a length one too small leaves trailing bytes,
// one too large swallows the next tag and still parses.
check("full payload parses with nothing left over", typeof top, "object");
check("its own CRC verifies", crcIsValid(payload), true);
check("a payload with one character changed does not", crcIsValid(payload.slice(0, 20) + "X" + payload.slice(21)), false);

// The one that actually costs money: a wrong length here points the transfer
// at a different account, and the QR still scans.
const tampered = payload.replace("01101234567890", "0111234567890");
check("a shortened account-number length is caught", (() => {
  try { parseTlv(parseTlv(parseTlv(tampered)["38"])["01"]); return "parsed"; }
  catch { return "rejected"; }
})(), "rejected");

/* -------------------------------------------------------------------- */
console.log("\n-- a static QR omits the amount rather than sending zero");

const noAmount = vietQrPayload({ bankBin: "970436", accountNumber: "1234567890" });
const staticTop = parseTlv(noAmount);
check("no amount field at all", "54" in staticTop, false);
check("marked static", staticTop["01"], "11");
check("still checksums", crcIsValid(noAmount), true);

/* -------------------------------------------------------------------- */
console.log("\n-- the memo is reduced to what a bank will carry");

check("diacritics are folded", sanitiseMemo("Thanh toán tháng 9"), "Thanh toan thang 9");
check("đ becomes d", sanitiseMemo("đơn TLS"), "don TLS");
check("punctuation goes", sanitiseMemo("TLS-ABC_123!"), "TLSABC123");
check("capped at 25 characters", sanitiseMemo("A".repeat(40)).length, 25);
check("a reference passes through untouched", sanitiseMemo("TLS ABC123"), "TLS ABC123");

/* -------------------------------------------------------------------- */
console.log("\n-- bad input is refused, not encoded");

throws("five-digit BIN", () => vietQrPayload({ bankBin: "97043", accountNumber: "1234567890" }));
throws("letters in the BIN", () => vietQrPayload({ bankBin: "97O436", accountNumber: "1234567890" }));
throws("account number too short", () => vietQrPayload({ bankBin: "970436", accountNumber: "123" }));
throws("negative amount", () => vietQrPayload({ bankBin: "970436", accountNumber: "1234567890", amount: -1 }));
throws("fractional dong", () => vietQrPayload({ bankBin: "970436", accountNumber: "1234567890", amount: 1.5 }));

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
