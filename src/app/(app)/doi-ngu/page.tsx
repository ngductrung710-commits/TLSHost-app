import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";

import { InviteForm } from "./InviteForm";
import { inviteMember, removeMember, updateMember } from "./actions";
import { getT } from "@/lib/locale";
import { fill } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Đội ngũ") };
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Chủ nhà",
  COLLABORATOR: "Cộng tác viên",
  HOUSEKEEPER: "Dọn phòng",
};

const ROLE_STYLES: Record<string, string> = {
  OWNER: "bg-ink-900 text-sand-100",
  COLLABORATOR: "bg-sand-200 text-ink-700",
  HOUSEKEEPER: "bg-clay-100 text-clay-700",
};

export default async function TeamPage() {
  const t = await getT();
  const member = await requireMember();
  // The team list carries everyone's email address.
  if (member.role === "HOUSEKEEPER") redirect("/buong-phong");

  const { members, properties } = await withOrg(member.orgId, async (tx) => {
    const members = await tx.membership.findMany({
      select: {
        id: true,
        role: true,
        canEditOthersBookings: true,
        joinedAt: true,
        inviteExpiresAt: true,
        user: { select: { name: true, email: true } },
        scopes: { select: { property: { select: { name: true } } } },
      },
      orderBy: [{ role: "asc" }, { invitedAt: "asc" }],
    });

    const properties = await tx.property.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return { members, properties };
  });

  // The invite link has to be absolute for someone to paste it into Zalo.
  // Built from the request host rather than an env var so it is right in
  // development, on the VPS, and behind whatever domain gets pointed at it.
  const head = await headers();
  const host = head.get("host") ?? "localhost:3001";
  const proto = head.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const isOwner = member.role === "OWNER";

  return (
    <>
      <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
        {t("Đội ngũ & phân quyền")}
      </h1>
      <p className="mt-1 text-[14px] text-ink-600">
        {fill(t("{n} người đang hoạt động"), {
          n: members.filter((m) => m.joinedAt).length,
        })}
        {members.some((m) => !m.joinedAt)
          ? fill(t(" · {n} lời mời đang chờ"), {
              n: members.filter((m) => !m.joinedAt).length,
            })
          : ""}
      </p>

      <ul className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
        {members.map((m) => {
          const pending = !m.joinedAt;
          const expired =
            pending && m.inviteExpiresAt !== null && m.inviteExpiresAt < new Date();

          return (
            <li key={m.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-200 font-mono text-[12px] font-bold text-ink-700">
                {m.user.name
                  .split(" ")
                  .slice(-2)
                  .map((w) => w[0])
                  .join("")
                  .toUpperCase()}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-ink-900">
                  {m.user.name}
                </p>
                <p className="truncate text-[12.5px] text-ink-500">
                  {m.user.email} ·{" "}
                  {m.scopes.length === 0
                    ? t("Tất cả chỗ nghỉ")
                    : m.scopes.map((s) => s.property.name).join(", ")}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {pending ? (
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      expired
                        ? "bg-danger-soft text-danger"
                        : "bg-warning-soft text-warning"
                    }`}
                  >
                    {expired ? t("Lời mời hết hạn") : t("Đang chờ")}
                  </span>
                ) : null}

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ROLE_STYLES[m.role]}`}
                >
                  {t(ROLE_LABELS[m.role])}
                </span>
              </div>

              {isOwner && m.role === "COLLABORATOR" ? (
                <form action={updateMember} className="flex items-center gap-2">
                  <input type="hidden" name="membershipId" value={m.id} />
                  {/* Submits on toggle rather than behind a Save button: it is
                      one boolean, and a button people forget to press is worse
                      than a change they can immediately toggle back. */}
                  <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-600">
                    <input
                      type="checkbox"
                      name="canEditOthersBookings"
                      defaultChecked={m.canEditOthersBookings}
                      className="h-4 w-4 rounded border-line-strong"
                    />
                    {t("Sửa được đặt phòng của người khác")}
                  </label>
                  <button
                    type="submit"
                    className="flex min-h-11 items-center rounded-full border border-line px-3 text-[12.5px] font-medium text-ink-700 hover:bg-sand-50"
                  >
                    {t("Lưu")}
                  </button>
                </form>
              ) : null}

              {isOwner && m.role !== "OWNER" ? (
                <form action={removeMember}>
                  <input type="hidden" name="membershipId" value={m.id} />
                  <button
                    type="submit"
                    className="flex min-h-11 items-center rounded-full px-3 text-[12.5px] font-medium text-danger hover:bg-danger-soft"
                  >
                    {t("Gỡ khỏi đội")}
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
        {t("Gỡ một người có hiệu lực ngay ở request kế tiếp của họ — không phải chờ phiên đăng nhập hết hạn.")}
      </p>

      {isOwner ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.25rem] font-semibold text-ink-900">
            {t("Mời người mới")}
          </h2>
          <p className="mb-6 mt-1 max-w-xl text-[14px] leading-relaxed text-ink-600">
            {t("Tạo lời mời rồi gửi link cho họ. Chưa có gửi email tự động, nên bạn tự gửi qua Zalo hoặc tin nhắn.")}
          </p>
          <InviteForm action={inviteMember} properties={properties} origin={origin} />
        </section>
      ) : null}
    </>
  );
}
