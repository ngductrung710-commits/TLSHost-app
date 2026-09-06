// Checks the iCal reader and writer against real-shaped feeds.
//
//   npm run check:ical
//
// Kept as a script rather than a test-runner suite because it needs no runner:
// the module has no dependencies beyond one date helper, and the whole point is
// that it can be run against a feed a host has pasted in when something looks
// wrong. `npm run check:ical -- path/to/feed.ics` is one edit away.
//
// The build step ahead of it bundles the TypeScript so this stays plain Node.
import { parseIcal, buildIcal, nightsIn } from "../.tmp/ical.mjs";

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const iso = (d) => d.toISOString().slice(0, 10);

/* -------------------------------------------------------------------- */
/* 1. An Airbnb-shaped feed, CRLF, folded UID, placeholder summary       */
/* -------------------------------------------------------------------- */

const airbnb = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "CALSCALE:GREGORIAN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260715",
  "DTSTART;VALUE=DATE:20260712",
  "UID:1a2b3c4d5e6f7890abcdef1234567890aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  " bbbbbbbbbbbbbbbb@airbnb.com",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20260720",
  "DTSTART;VALUE=DATE:20260718",
  "UID:short-uid@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const a = parseIcal(airbnb);
check("airbnb: two events parsed", a.events.length, 2);
check("airbnb: none skipped", a.skipped, 0);
check("airbnb: first range", [iso(a.events[0].start), iso(a.events[0].end)],
      ["2026-07-12", "2026-07-15"]);
check("airbnb: DTEND is exclusive — 3 nights, not 4", nightsIn(a.events[0]), 3);
check("airbnb: folded UID rejoined", a.events[0].uid,
      "1a2b3c4d5e6f7890abcdef1234567890aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabbbbbbbbbbbbbbbb@airbnb.com");
check("airbnb: summary", a.events[1].summary, "Airbnb (Not available)");

/* -------------------------------------------------------------------- */
/* 2. Malformed events are skipped, not fatal                            */
/* -------------------------------------------------------------------- */

const messy = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",           // no UID
  "DTSTART;VALUE=DATE:20260801",
  "DTEND;VALUE=DATE:20260803",
  "END:VEVENT",
  "BEGIN:VEVENT",           // backwards range
  "UID:backwards@x",
  "DTSTART;VALUE=DATE:20260810",
  "DTEND;VALUE=DATE:20260805",
  "END:VEVENT",
  "BEGIN:VEVENT",           // zero nights
  "UID:empty@x",
  "DTSTART;VALUE=DATE:20260901",
  "DTEND;VALUE=DATE:20260901",
  "END:VEVENT",
  "BEGIN:VEVENT",           // good
  "UID:good@x",
  "DTSTART;VALUE=DATE:20261001",
  "DTEND;VALUE=DATE:20261004",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\n");                // LF only, which some feeds use

const m = parseIcal(messy);
check("messy: one good event survives", m.events.map((e) => e.uid), ["good@x"]);
check("messy: three skipped", m.skipped, 3);

/* -------------------------------------------------------------------- */
/* 3. DATE-TIME form keeps the calendar day                              */
/* -------------------------------------------------------------------- */

const timed = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:timed@booking.com",
  "DTSTART:20260712T150000Z",
  "DTEND:20260715T110000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const t = parseIcal(timed);
check("timed: date kept, time discarded",
      [iso(t.events[0].start), iso(t.events[0].end)], ["2026-07-12", "2026-07-15"]);

/* -------------------------------------------------------------------- */
/* 4. A Booking.com-shaped feed                                          */
/* -------------------------------------------------------------------- */
//
// Cùng chuẩn với Airbnb nhưng khác thói quen, và mỗi khác biệt ở đây từng là
// một feed đọc ra rỗng ở đâu đó: thứ tự thuộc tính khác (UID xuống cuối), có
// DTSTAMP và LAST-MODIFIED xen giữa, SUMMARY là "CLOSED - Not available" thay
// vì "Reserved", và có sự kiện không có SUMMARY nào cả.
//
// Đây là hình dạng dựng theo mô tả, không phải feed thật cắt ra từ một tài
// khoản — nên nó trả lời được "bộ đọc có vấp không", và không trả lời được
// "Booking.com hôm nay có gửi đúng thế này không". Muốn biết cái sau thì phải
// cắm một tài khoản thật.

const bookingCom = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Booking.com B.V.//NONSGML Booking.com Calendar//EN",
  "VERSION:2.0",
  "CALSCALE:GREGORIAN",
  "BEGIN:VEVENT",
  "DTSTAMP:20270301T101500Z",
  "DTSTART;VALUE=DATE:20270310",
  "DTEND;VALUE=DATE:20270313",
  "LAST-MODIFIED:20270301T101500Z",
  "SUMMARY:CLOSED - Not available",
  "UID:4451234567-1@booking.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20270318",
  "DTEND;VALUE=DATE:20270320",
  "UID:4451234567-2@booking.com",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

const bc = parseIcal(bookingCom);
check("booking.com: hai sự kiện, không bỏ sót", [bc.events.length, bc.skipped], [2, 0]);
check("booking.com: UID nằm cuối vẫn đọc được", bc.events[0].uid,
      "4451234567-1@booking.com");
check("booking.com: DTSTAMP không bị nhầm thành DTSTART",
      [iso(bc.events[0].start), iso(bc.events[0].end)], ["2027-03-10", "2027-03-13"]);
check("booking.com: DTEND vẫn là loại trừ — 3 đêm", nightsIn(bc.events[0]), 3);
check("booking.com: summary kiểu CLOSED giữ nguyên", bc.events[0].summary,
      "CLOSED - Not available");
check("booking.com: không có SUMMARY vẫn nhận sự kiện", bc.events[1].summary, null);

/* -------------------------------------------------------------------- */
/* 5. Empty feed                                                         */
/* -------------------------------------------------------------------- */

const empty = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";
check("empty feed: no events, no skips",
      [parseIcal(empty).events.length, parseIcal(empty).skipped], [0, 0]);

/* -------------------------------------------------------------------- */
/* 6. Round trip: what we write, we can read back unchanged              */
/* -------------------------------------------------------------------- */

const out = buildIcal({
  name: "An Bàng Villa — Garden Suite",
  events: [
    {
      uid: "booking-abc123@tlshost.vn",
      start: new Date("2026-07-12T00:00:00Z"),
      end: new Date("2026-07-15T00:00:00Z"),
      summary: "Đã đặt",
    },
    {
      uid: "block-def456@tlshost.vn",
      start: new Date("2026-08-01T00:00:00Z"),
      end: new Date("2026-08-04T00:00:00Z"),
      summary: "Bảo trì; không nhận khách, xem ghi chú",
    },
  ],
});

check("export: CRLF line endings", /\r\n/.test(out) && !/[^\r]\n/.test(out), true);
check("export: DTEND exclusive as written", /DTEND;VALUE=DATE:20260715/.test(out), true);
check("export: no guest name leaked", /Linh|guest|@thelocalstay/.test(out), false);
check("export: semicolon and comma escaped",
      /SUMMARY:Bảo trì\\; không nhận khách\\, xem ghi chú/.test(out), true);
check("export: every line within 75 octets",
      out.split("\r\n").every((l) => Buffer.from(l, "utf8").length <= 75), true);

const back = parseIcal(out);
check("round trip: two events", back.events.length, 2);
check("round trip: ranges survive",
      back.events.map((e) => [iso(e.start), iso(e.end)]),
      [["2026-07-12", "2026-07-15"], ["2026-08-01", "2026-08-04"]]);
check("round trip: uids survive",
      back.events.map((e) => e.uid),
      ["booking-abc123@tlshost.vn", "block-def456@tlshost.vn"]);
check("round trip: escaped summary comes back intact",
      back.events[1].summary, "Bảo trì; không nhận khách, xem ghi chú");

/* -------------------------------------------------------------------- */
/* 7. A long Vietnamese summary must fold without corrupting UTF-8       */
/* -------------------------------------------------------------------- */

const longSummary = "Đã đặt — phòng này đã kín, vui lòng kiểm tra lại lịch trước khi xác nhận thêm khách nào nữa";
const folded = buildIcal({
  name: "x",
  events: [{
    uid: "long@tlshost.vn",
    start: new Date("2026-07-12T00:00:00Z"),
    end: new Date("2026-07-13T00:00:00Z"),
    summary: longSummary,
  }],
});
check("fold: lines still within 75 octets",
      folded.split("\r\n").every((l) => Buffer.from(l, "utf8").length <= 75), true);
check("fold: summary survives the round trip",
      parseIcal(folded).events[0].summary, longSummary);

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
