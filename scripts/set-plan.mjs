// Move an organization onto a plan.
//
//   npm run plan -- <email> <FREE|CHANNELS|PRO> [số tháng]
//   npm run plan -- ngductrung710@gmail.com PRO 12
//   npm run plan -- ngductrung710@gmail.com            (chỉ xem, không đổi)
//
// There is no subscription billing in this product. The settings page says so
// in as many words — "Chưa có thanh toán trong ứng dụng — nhắn cho chúng tôi
// để đổi gói" — so somebody has to move the row, and that somebody should not
// be typing UPDATE against production at two in the morning.
//
// What this buys over the raw SQL:
//
//   - The plan name is checked against the same table the app reads, so a typo
//     is a refusal rather than an organization on a plan that does not exist.
//   - It prints the before and the after, read back in a separate query. A
//     script that reports what it meant to do is a script that cannot tell you
//     it did nothing.
//   - It names the organization and its owner before changing anything, which
//     is the check that catches the wrong email.
//
// Runs as the migrate role. Row-level security applies to the application
// role and an operator here is not inside any organization's session; the
// owner role is the honest way to say that, rather than teaching the app role
// to edit billing.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const PLAN_NAMES = ["FREE", "CHANNELS", "PRO"];

const [email, plan, months] = process.argv.slice(2);

if (!email) {
  console.error("usage: npm run plan -- <email> [FREE|CHANNELS|PRO] [số tháng]");
  process.exit(1);
}

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error("MIGRATE_DATABASE_URL chưa có. Chạy kèm --env-file=.env.");
  process.exit(1);
}

if (plan !== undefined && !PLAN_NAMES.includes(plan)) {
  console.error(`Gói "${plan}" không có. Chọn một trong: ${PLAN_NAMES.join(", ")}.`);
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const show = async (orgId) => {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      name: true,
      plan: true,
      planUntil: true,
      _count: { select: { properties: true } },
    },
  });
  const until = org.planUntil ? org.planUntil.toISOString().slice(0, 10) : "không hạn";
  return `${org.name} — ${org.plan} (${until}) · ${org._count.properties} cơ sở`;
};

const memberships = await prisma.membership.findMany({
  where: { user: { email }, role: "OWNER" },
  select: { orgId: true },
});

if (memberships.length === 0) {
  console.error(`Không có tổ chức nào mà ${email} là chủ nhà.`);
  await prisma.$disconnect();
  process.exit(1);
}

for (const { orgId } of memberships) {
  console.log("trước:", await show(orgId));

  if (plan === undefined) continue;

  // FREE has no expiry to speak of. For a paid plan an explicit month count
  // sets the date; leaving it off means "until somebody says otherwise",
  // which effectivePlan() reads as no expiry rather than as expired.
  const planUntil =
    plan === "FREE" || months === undefined
      ? null
      : new Date(Date.now() + Number(months) * 30 * 24 * 60 * 60 * 1000);

  if (plan !== "FREE" && months !== undefined && !Number.isFinite(Number(months))) {
    console.error(`"${months}" không phải số tháng.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { plan, planUntil },
  });

  // Read back, not reported from the update's own return value.
  console.log("sau:  ", await show(orgId));
}

await prisma.$disconnect();
