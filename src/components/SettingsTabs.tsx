import Link from "next/link";

import { getT } from "@/lib/locale";

/**
 * The four settings tabs.
 *
 * Three of them are one page filtered by a query string; the fourth is the
 * team page, which stays a route of its own. That split is deliberate — the
 * team screen loads a different set of rows and has its own actions, and
 * folding it into the settings page to make the URLs tidier would have meant
 * moving a hundred and eighty working lines for a cosmetic gain.
 *
 * Links rather than buttons, so which tab you are on survives a refresh and
 * can be sent to someone.
 */

export type SettingsTab = "chung" | "nguoi-dung" | "thanh-toan" | "goi";

export async function SettingsTabs({
  current,
  showTeam,
  showBilling,
}: {
  current: SettingsTab;
  /** Housekeepers and collaborators never see the team or the money. */
  showTeam: boolean;
  showBilling: boolean;
}) {
  const t = await getT();

  const tabs: { key: SettingsTab; label: string; href: string; show: boolean }[] = [
    { key: "chung", label: t("Chung"), href: "/cai-dat", show: true },
    { key: "nguoi-dung", label: t("Người dùng / Nhóm"), href: "/doi-ngu", show: showTeam },
    { key: "thanh-toan", label: t("Thanh toán"), href: "/cai-dat?muc=thanh-toan", show: showBilling },
    { key: "goi", label: t("Gói dịch vụ"), href: "/cai-dat?muc=goi", show: showBilling },
  ];

  return (
    <nav
      aria-label={t("Cài đặt")}
      className="mt-4 flex flex-wrap gap-1 border-b border-line"
    >
      {tabs
        .filter((tab) => tab.show)
        .map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-3 text-[14px] font-semibold transition-colors ${
                active
                  ? "border-brand text-ink-900"
                  : "border-transparent text-ink-500 hover:text-ink-900"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
    </nav>
  );
}
