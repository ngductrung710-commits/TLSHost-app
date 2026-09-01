// Pending purchases, and confirming one.
//
//   npm run purchases                    -- danh sách đơn đang chờ
//   npm run purchases -- <mã>            -- xác nhận đã nhận tiền
//
// The bank statement is the source of truth and it is not connected to
// anything, so a person reads it and confirms here. That person is the weak
// link on purpose: matching transfers automatically means trusting a bank
// integration with the question "should this organization get another month",
// and there is no such integration yet.
//
// Confirming twice is safe. applyPurchase claims the row with a conditional
// update before it reads anything, so the second attempt reports that it was
// already settled and touches nothing.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { applyPurchase } from "../.tmp/purchases.mjs";

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error("MIGRATE_DATABASE_URL chưa có. Chạy kèm --env-file=.env.");
  process.exit(1);
}

// The migrate role, not the app role. Row-level security scopes the app to one
// organization per request, and an operator confirming payments is looking
// across all of them.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const reference = process.argv[2];
const money = (n) => `${n.toLocaleString("vi-VN")} ₫`;
const day = (d) => (d ? d.toISOString().slice(0, 10) : "—");

try {
  if (!reference) {
    const pending = await prisma.planPurchase.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        reference: true,
        plan: true,
        amount: true,
        createdAt: true,
        org: { select: { name: true, plan: true, planUntil: true } },
      },
    });

    if (pending.length === 0) {
      console.log("Không có đơn nào đang chờ.");
    } else {
      console.log(`${pending.length} đơn đang chờ:\n`);
      for (const p of pending) {
        console.log(
          `  ${p.reference}  ${money(p.amount).padStart(12)}  ${p.plan.padEnd(8)} ` +
            `${p.org.name} (đang ${p.org.plan}, tới ${day(p.org.planUntil)})  ` +
            `mở ${day(p.createdAt)}`,
        );
      }
      console.log("\nXác nhận:  npm run purchases -- <mã>");
    }
  } else {
    const found = await prisma.planPurchase.findUnique({
      where: { reference },
      select: { id: true, status: true, amount: true, plan: true, org: { select: { name: true } } },
    });
    if (!found) {
      console.error(`Không có đơn nào mang mã ${reference}.`);
      process.exit(1);
    }
    if (found.status !== "PENDING") {
      console.error(`Đơn ${reference} đã ở trạng thái ${found.status}, không xử lý lại.`);
      process.exit(1);
    }

    console.log(`${found.org.name} — ${found.plan}, ${money(found.amount)}`);

    const result = await prisma.$transaction((tx) => applyPurchase(tx, found.id));
    if (!result.ok) {
      console.error(`Không áp dụng được: ${result.reason}`);
      process.exit(1);
    }

    // Read back from the organization, not from the result, so what is printed
    // is what the next request will read.
    const org = await prisma.planPurchase.findUnique({
      where: { id: found.id },
      select: { org: { select: { name: true, plan: true, planUntil: true } } },
    });
    console.log(`✓ ${org.org.name} — ${org.org.plan}, tới ${day(org.org.planUntil)}`);
  }
} finally {
  await prisma.$disconnect();
}
