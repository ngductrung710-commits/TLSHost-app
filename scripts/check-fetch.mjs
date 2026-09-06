// Đường mạng thật của đồng bộ kênh: fetchFeed, không tiêm gì.
//
//   npm run check:fetch
//
// check:sync tiêm fetchImpl cho mọi trường hợp, nên lớp duy nhất thật sự nói
// chuyện với Airbnb chưa từng chạy trong bộ kiểm tra nào. Tệp này dựng một máy
// chủ HTTP thật ở localhost, trỏ importUrl vào đó, và gọi runSync để nó tự đi
// lấy — đúng đường đi trên máy chủ thật, chỉ khác cái tên miền.
//
// Câu hỏi quan trọng nhất ở đây không phải "lấy được lịch chưa" mà "khi lấy
// hỏng thì có xoá nhầm không". Airbnb sập, mạng đứt, hay trả về trang đăng
// nhập — cả ba đều phải để nguyên lịch. Một block bị xoá nhầm là một đêm bị
// đặt trùng.
//
// Tạo tổ chức riêng và xoá lúc xong, nên chạy được trên cơ sở dữ liệu thật.

import { createServer } from "node:http";
import { gzipSync } from "node:zlib";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { runSync } from "../.tmp/sync.mjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) console.log(`      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const ORG = "check-fetch-org";
const ROOM = "check-fetch-room";
const CHANNEL = "check-fetch-channel";

const withOrg = (fn) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${ORG}, true)`;
    return fn(tx);
  });

// Hình dạng thật của một feed Airbnb: CRLF, dòng gập ở cột 75 với một dấu
// cách đầu dòng tiếp theo, DTSTART;VALUE=DATE, và mấy thuộc tính riêng của
// Airbnb mà bộ đọc phải bỏ qua chứ không được vấp.
const FEED = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Airbnb Inc//Hosting Calendar 1.0.0//EN",
  "CALSCALE:GREGORIAN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20270312",
  "DTSTART;VALUE=DATE:20270310",
  "UID:aaaaaaaaaaaaaaaaaaaaaaaa@airbnb.com",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/d",
  " etails/HMABCDEFGH\nPhone Number (Last 4 Digits): 1234",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20270320",
  "DTSTART;VALUE=DATE:20270318",
  "UID:bbbbbbbbbbbbbbbbbbbbbbbb@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20270405",
  "DTSTART;VALUE=DATE:20270401",
  "UID:cccccccccccccccccccccccc@airbnb.com",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

const LOGIN_PAGE =
  "<!doctype html><html><head><title>Log in</title></head>" +
  "<body><form action=/login><input name=email></form></body></html>";

const server = createServer((req, res) => {
  const path = (req.url ?? "").split("?")[0];
  if (path === "/ok.ics") {
    res.writeHead(200, { "content-type": "text/calendar; charset=utf-8" });
    res.end(FEED);
  } else if (path === "/gzip.ics") {
    res.writeHead(200, {
      "content-type": "text/calendar",
      "content-encoding": "gzip",
    });
    res.end(gzipSync(Buffer.from(FEED, "utf8")));
  } else if (path === "/redirect") {
    res.writeHead(302, { location: "/ok.ics" });
    res.end();
  } else if (path === "/login") {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(LOGIN_PAGE);
  } else {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("no such calendar");
  }
});

const port = await new Promise((resolve) => {
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});
const at = (path) => `http://127.0.0.1:${port}${path}`;

const point = (url) =>
  withOrg((tx) => tx.channel.update({ where: { id: CHANNEL }, data: { importUrl: url } }));

const blockCount = () =>
  withOrg((tx) => tx.block.count({ where: { channelId: CHANNEL } }));

const sync = async (url) => {
  await point(url);
  const outcome = await runSync({ orgId: ORG, channelId: CHANNEL });
  return { ...outcome, blocks: await blockCount() };
};

async function cleanup() {
  await prisma.$executeRaw`DELETE FROM organization WHERE id = ${ORG}`;
  await prisma.$executeRaw`DELETE FROM room WHERE id = ${ROOM}`;
}

try {
  await cleanup();
  await prisma.$executeRaw`INSERT INTO organization (id, name, "updatedAt") VALUES (${ORG}, 'Fetch check', now())`;
  await withOrg(async (tx) => {
    await tx.property.create({
      data: {
        id: "check-fetch-prop",
        orgId: ORG,
        name: "P",
        rooms: { create: { id: ROOM, orgId: ORG, name: "R" } },
      },
    });
    await tx.channel.create({
      data: {
        id: CHANNEL, orgId: ORG, roomId: ROOM, kind: "AIRBNB",
        importUrl: at("/ok.ics"),
      },
    });
  });

  console.log("\n-- lấy được lịch thật qua HTTP");
  let r = await sync(at("/ok.ics"));
  check("ba kỳ đặt về, ba block", [r.status, r.eventsSeen, r.eventsApplied, r.blocks], ["OK", 3, 3, 3]);
  check("không lỗi", r.error, null);

  console.log("\n-- lấy hỏng thì phải giữ nguyên lịch");
  r = await sync(at("/khong-co.ics"));
  check("404 — hỏng, block còn nguyên", [r.status, r.blocks], ["FAILED", 3]);
  check("404 — nói rõ mã", r.error, "Máy chủ kênh trả về 404");

  r = await sync(at("/login"));
  check("trang đăng nhập 200 — hỏng, block còn nguyên", [r.status, r.blocks], ["FAILED", 3]);
  check("trang đăng nhập — không đọc thành lịch rỗng", r.error, "Nội dung trả về không phải lịch iCal");

  r = await sync("http://127.0.0.1:1/feed.ics");
  check("không kết nối được — hỏng, block còn nguyên", [r.status, r.blocks], ["FAILED", 3]);

  console.log("\n-- những gì OTA thật hay làm");
  r = await sync(at("/redirect"));
  check("302 — đi theo tới lịch", [r.status, r.eventsSeen, r.blocks], ["OK", 3, 3]);

  r = await sync(at("/gzip.ics"));
  check("gzip — giải nén rồi đọc", [r.status, r.eventsSeen, r.blocks], ["OK", 3, 3]);

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} lỗi`);
  if (failures > 0) process.exitCode = 1;
} finally {
  await cleanup();
  await prisma.$disconnect();
  server.close();
}
