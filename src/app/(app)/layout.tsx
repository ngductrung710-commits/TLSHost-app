import type { ReactNode } from "react";

import { AssistantTab } from "@/components/AssistantTab";
import { SidebarNav, type NavItem } from "@/components/SidebarNav";
import { daysUntil } from "@/lib/billing";
import { requireMember } from "@/lib/dal";
import { effectivePlan } from "@/lib/plans";
import { getT, readLocale } from "@/lib/locale";

import { signOut } from "../(auth)/actions";
import { setLocale } from "./cai-dat/localeAction";

/**
 * The signed-in shell. requireMember() runs here, so every page in this group
 * is behind it — but each page and action calls it again for its own data,
 * because a layout is not a security boundary: it does not re-run for every
 * navigation, and a server action reached directly never passes through it.
 *
 * The rail scrolls independently of the page. `h-dvh` with `overflow-hidden`
 * on the frame and the scroll on <main> is what keeps the navigation in place
 * on a long calendar rather than having it slide away above the fold.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const t = await getT();
  const member = await requireMember();
  const locale = await readLocale();

  // A housekeeper gets two entries, because every other screen holds something
  // they are not meant to see. Those pages redirect them anyway — this keeps
  // the rail from offering doors that close in their face, which is a
  // different job from the redirect and needs doing separately.
  const items: NavItem[] =
    member.role === "HOUSEKEEPER"
      ? [
          { href: "/buong-phong", label: t("Buồng phòng"), icon: "sparkle" },
          { href: "/cai-dat", label: t("Cài đặt"), icon: "gear" },
        ]
      : [
          { href: "/lich", label: t("Lịch"), icon: "calendar" },
          { href: "/tong-quan", label: t("Bảng điều khiển"), icon: "grid" },
          { href: "/buong-phong", label: t("Buồng phòng"), icon: "sparkle" },
          { href: "/cho-nghi", label: t("Chỗ nghỉ"), icon: "building" },
          { href: "/kenh", label: t("Kênh bán"), icon: "plug" },
          { href: "/cai-dat", label: t("Cài đặt"), icon: "gear" },
        ];

  // Two screens deliberately do not get a rail entry, and both are still one
  // click away:
  //
  //   /ban-hang  — from the calendar toolbar, which is where someone is when
  //                a guest asks about dates.
  //   /doi-ngu   — it is the "Người dùng / Nhóm" tab of Settings.
  //   /tro-ly    — the tab clipped to the right edge, below.
  //
  // A rail that lists everything stops being a way to find anything. But every
  // one of these has to be reachable from somewhere: the first cut of this
  // list dropped the assistant and left nothing pointing at it.

  /**
   * What the rail's plan badge says.
   *
   * `limits.name` is the plan *in force* — limitsFor() has already resolved a
   * lapsed subscription down to FREE — so the badge cannot claim a plan the
   * software is refusing to honour. Whether it lapsed is a separate fact, and
   * the badge says that too, because "Miễn phí" on its own reads like a choice
   * rather than like something that ran out.
   *
   * Only an owner gets a link: the plan section of settings is theirs alone,
   * so for anyone else this is a label and clicking it would land on a screen
   * with nothing on it.
   */
  const active = effectivePlan(member.plan, member.planUntil);
  const planBadge = {
    name: member.limits.name,
    paid: active !== "FREE",
    daysLeft: active === "FREE" ? null : daysUntil(member.planUntil),
    lapsed: member.plan !== "FREE" && active === "FREE",
    href: member.role === "OWNER" ? "/cai-dat?muc=goi" : null,
  };

  return (
    <div className="app-shell flex h-dvh overflow-hidden bg-canvas">
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-[14px] focus:text-white"
      >
        {t("Tới nội dung chính")}
      </a>

      <SidebarNav
        items={items}
        userName={member.userName}
        orgName={member.orgName}
        plan={planBadge}
        signOut={signOut}
        setLocale={setLocale}
        locale={locale}
      />

      {/* The padding lives here rather than on each page so every screen lines
          up with the rail's edge. A page that wants a full-bleed toolbar — the
          calendar does — undoes it with a negative margin on that one element,
          which is cheaper than making twelve pages carry their own frame. */}
      <main id="noi-dung" className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {children}
      </main>

      {/* Not for housekeepers: the assistant reads and writes bookings, and
          the page turns them away anyway. */}
      {member.role !== "HOUSEKEEPER" ? <AssistantTab /> : null}
    </div>
  );
}
