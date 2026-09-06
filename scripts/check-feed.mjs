// Route xuất lịch cho OTA đọc: /feed/[token].
//
//   npm run check:feed
//
// Đây là nửa lời hứa lớn của sản phẩm mà chưa dòng kiểm tra nào chạm tới.
// check:ical thử buildIcal, nhưng chưa ai từng gọi chính cái route đó — nơi
// quyết định token nào mở được gì, và cái gì lọt ra ngoài cho người lạ đọc.
//
// Gọi thẳng handler chứ không qua HTTP: nó là một hàm nhận Request và trả
// Response, nên không cần máy chủ chạy, và cả logic RLS lẫn nội dung feed đều
// đi qua đúng đường thật.
//
// Ba câu hỏi:
//   1. Airbnb đọc được không — tự phân tích lại chính feed mình vừa viết ra.
//   2. Token sai có mở được gì không.
//   3. Có rò tên khách, giá, số điện thoại ra không.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { GET, parseIcal } from "../.tmp/feed.mjs";

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

const ORG = "check-feed-org";
const ROOM = "check-feed-room";
const TOKEN = "check-feed-token-0123456789abcdef";

// Tổ chức thứ hai, tồn tại chỉ để trả lời một câu: token của nhà này có kéo
// được lịch của nhà kia không. Không có nó, mọi khẳng định "token sai trả 404"
// đều đúng một cách rỗng — trong cơ sở dữ liệu chỉ có đúng một phòng để trả về.
const NHA_HANG_XOM = ["", "-- token nhà này không mở được lịch nhà kia"].join(String.fromCharCode(10));

const ORG2 = "check-feed-org-2";
const ROOM2 = "check-feed-room-2";
const TOKEN2 = "check-feed-token-hang-xom-9876543210";

const inOrg = (org, fn) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${org}, true)`;
    return fn(tx);
  });
const withOrg = (fn) => inOrg(ORG, fn);

const day = (iso) => new Date(`${iso}T00:00:00.000Z`);
const ymd = (d) => d.toISOString().slice(0, 10);

const call = async (token) => {
  const res = await GET(new Request(`https://tlshost.vn/feed/${token}`), {
    params: Promise.resolve({ token }),
  });
  return { status: res.status, headers: res.headers, body: await res.text() };
};

async function cleanup() {
  for (const id of [ORG, ORG2]) {
    await prisma.$executeRaw`DELETE FROM organization WHERE id = ${id}`;
  }
  for (const id of [ROOM, ROOM2]) {
    await prisma.$executeRaw`DELETE FROM room WHERE id = ${id}`;
  }
}

try {
  await cleanup();
  await prisma.$executeRaw`INSERT INTO organization (id, name, "updatedAt") VALUES (${ORG}, 'Feed check', now())`;
  await withOrg(async (tx) => {
    await tx.property.create({
      data: {
        id: "check-feed-prop",
        orgId: ORG,
        name: "Nhà Kiểm Tra",
        rooms: {
          create: { id: ROOM, orgId: ORG, name: "Phòng A", icalToken: TOKEN },
        },
      },
    });
    await tx.booking.create({
      data: {
        orgId: ORG, roomId: ROOM,
        guestName: "Nguyễn Bí Mật",
        guestEmail: "bimat@example.invalid",
        guestPhone: "0987654321",
        checkIn: day("2027-05-10"), checkOut: day("2027-05-13"),
        totalCents: 4_200_000,
        notes: "Ghi chú riêng của chủ nhà",
      },
    });
    await tx.block.create({
      data: {
        orgId: ORG, roomId: ROOM,
        dateFrom: day("2027-06-01"), dateTo: day("2027-06-03"),
        reason: "MAINTENANCE",
      },
    });
    // Một đơn đã huỷ: những đêm đó phải mở lại, không được khoá tiếp.
    await tx.booking.create({
      data: {
        orgId: ORG, roomId: ROOM, guestName: "Đã huỷ",
        checkIn: day("2027-07-01"), checkOut: day("2027-07-04"),
        status: "CANCELLED",
      },
    });
  });

  await prisma.$executeRaw`INSERT INTO organization (id, name, "updatedAt") VALUES (${ORG2}, 'Nha hang xom', now())`;
  await inOrg(ORG2, async (tx) => {
    await tx.property.create({
      data: {
        id: "check-feed-prop-2",
        orgId: ORG2,
        name: "Nhà Hàng Xóm",
        rooms: {
          create: { id: ROOM2, orgId: ORG2, name: "Phòng B", icalToken: TOKEN2 },
        },
      },
    });
    await tx.booking.create({
      data: {
        orgId: ORG2, roomId: ROOM2, guestName: "Khách nhà hàng xóm",
        checkIn: day("2027-09-20"), checkOut: day("2027-09-25"),
      },
    });
  });

  console.log("\n-- OTA đọc được feed mình viết ra");
  const ok = await call(TOKEN);
  check("trả 200", ok.status, 200);
  check("nói mình là lịch", ok.headers.get("content-type"), "text/calendar; charset=utf-8");
  check("cấm bộ nhớ đệm", ok.headers.get("cache-control"), "no-store, max-age=0");
  check("cấm lập chỉ mục", ok.headers.get("x-robots-tag"), "noindex, nofollow");

  const parsed = parseIcal(ok.body);
  const ranges = parsed.events
    .map((e) => `${ymd(e.start)}..${ymd(e.end)}`)
    .sort();
  check("tự đọc lại được đúng hai khoảng", ranges, [
    "2027-05-10..2027-05-13",
    "2027-06-01..2027-06-03",
  ]);
  check("đơn đã huỷ không khoá đêm nào", ranges.some((r) => r.startsWith("2027-07")), false);

  console.log("\n-- không rò gì cho người lạ");
  for (const [ten, secret] of [
    ["tên khách", "Bí Mật"],
    ["email khách", "bimat@example.invalid"],
    ["số điện thoại", "0987654321"],
    ["ghi chú riêng", "Ghi chú riêng"],
    ["giá", "4200000"],
  ]) {
    check(`${ten} không có trong feed`, ok.body.includes(secret), false);
  }

  console.log(NHA_HANG_XOM);
  const neighbour = await call(TOKEN2);
  check("hàng xóm có feed riêng của mình", neighbour.status, 200);
  check("feed nhà mình không chứa đêm nhà hàng xóm", ok.body.includes("20270920"), false);
  check("feed hàng xóm không chứa đêm nhà mình", neighbour.body.includes("20270510"), false);
  check("feed hàng xóm đúng là của hàng xóm", neighbour.body.includes("20270920"), true);

  console.log("\n-- token sai không mở được gì");
  const wrong = await call("khong-phai-token");
  check("token lạ trả 404", wrong.status, 404);
  check("token lạ không kèm lịch", wrong.body.includes("BEGIN:VCALENDAR"), false);

  const empty = await call("");
  check("token rỗng trả 404", empty.status, 404);

  console.log(failures === 0 ? "\nall checks passed" : `\n${failures} lỗi`);
  if (failures > 0) process.exitCode = 1;
} finally {
  await cleanup();
  await prisma.$disconnect();
}
