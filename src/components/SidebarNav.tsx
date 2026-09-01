"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { useT } from "@/components/I18nProvider";
import { fill } from "@/lib/i18n";

/**
 * The workspace's left rail.
 *
 * A client component for one reason: which item is current has to be decided
 * from the URL, and a server layout does not re-render on navigation — the
 * highlight would stick to whichever page was loaded first. Everything else
 * here is markup.
 *
 * Collapsing is remembered per device in localStorage rather than in a cookie,
 * because nothing on the server needs to know: the rail is the same width in
 * the HTML either way and the class changes after hydration. Wrapped in
 * try/catch because a private window throws on access rather than returning
 * null.
 */

export type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
};

const STORAGE_KEY = "tlshost_rail";

/**
 * The collapsed flag, as an external store rather than state set from an
 * effect.
 *
 * localStorage cannot be read while rendering on the server, so the obvious
 * shape — useState(false) plus a useEffect that corrects it — is what this
 * started as. That is a cascading render on every navigation, and React's own
 * lint rule says so. useSyncExternalStore exists for exactly this: a value
 * that lives outside React, with a separate server snapshot.
 */
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Private window, or site data blocked. The rail simply stays open.
    return false;
  }
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function snapshot(): boolean {
  if (cached === null) cached = read();
  return cached;
}

/** The server renders the rail open; there is no storage to consult there. */
const serverSnapshot = () => false;

function write(next: boolean) {
  cached = next;
  try {
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Not remembering it is a smaller problem than throwing here.
  }
  for (const onChange of listeners) onChange();
}

/**
 * Inline rather than an icon package. Twelve glyphs at one weight is less code
 * than the dependency that would draw them, and it keeps the stroke width
 * consistent — mixing two icon sets at 20px is visible immediately.
 */
const ICONS = {
  calendar: "M8 2v3M16 2v3M3.5 9.5h17M4 5.5h16a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z",
  grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  sparkle: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3ZM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z",
  building: "M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 21V10h5a1 1 0 0 1 1 1v10M3 21h18M7.5 8h3M7.5 12h3M7.5 16h3",
  gear: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.9 19.3a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.7 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9.1a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z",
  users: "M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM22 20v-1.5a4 4 0 0 0-3-3.87M16 3.63a4 4 0 0 1 0 7.75",
  plug: "M9 3v6M15 3v6M6 9h12v3a6 6 0 0 1-6 6 6 6 0 0 1-6-6V9ZM12 18v3",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.5 9h17M3.5 15h17M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  chevrons: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

export function SidebarNav({
  items,
  userName,
  orgName,
  plan,
  signOut,
  setLocale,
  locale,
}: {
  items: NavItem[];
  userName: string;
  orgName: string;
  plan: PlanBadge;
  signOut: () => Promise<void>;
  setLocale: (formData: FormData) => Promise<void>;
  locale: "vi" | "en";
}) {
  const t = useT();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, snapshot, serverSnapshot);

  const toggle = () => write(!collapsed);

  // "/lich" must not light up while you are on "/lich/moi"'s sibling
  // "/lich-something", so the boundary is checked rather than the prefix.
  const isCurrent = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      aria-label={t("Chính")}
      data-collapsed={collapsed ? "" : undefined}
      className={`z-30 flex h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ${
        collapsed ? "w-[68px]" : "w-56"
      }`}
    >
      <div className="flex h-16 items-center gap-2 px-3">
        <Link
          href={items[0]?.href ?? "/"}
          className="flex min-w-0 items-center gap-2.5 rounded-lg p-1"
        >
          {/* The plate in the artwork is #311817, which is exactly ink-800 —
              the logo was drawn against this palette. Giving the frame the
              same colour means the 255×250 source can be cropped square without
              a seam showing. */}
          <span className="size-9 shrink-0 overflow-hidden rounded-[10px] bg-ink-800">
            <Image
              src="/logo.png"
              alt=""
              width={255}
              height={250}
              priority
              className="size-full object-cover"
            />
          </span>
          {!collapsed ? (
            <span className="truncate text-[16px] tracking-tight text-ink-900">
              <span className="font-bold">TLS</span>
              <span className="font-normal">Host</span>
            </span>
          ) : null}
        </Link>

        {!collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={t("Thu gọn điều hướng")}
            title={t("Thu gọn điều hướng")}
            className="ml-auto grid size-8 place-items-center rounded-lg text-ink-400 hover:bg-sand-100 hover:text-ink-700"
          >
            <Icon name="chevrons" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        <ul className="grid gap-1">
          {items.map((item) => {
            const current = isCurrent(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={current ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold transition-colors ${
                    current
                      ? "bg-clay-50 text-brand"
                      : "text-ink-500 hover:bg-sand-100 hover:text-ink-900"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon name={item.icon} />
                  {!collapsed ? <span className="truncate">{item.label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="border-t border-line px-2 py-3">
        {!collapsed ? (
          <div className="mb-1 px-3 py-1">
            <p className="truncate text-[13px] font-semibold text-ink-900">{userName}</p>
            <p className="truncate text-[11px] text-ink-500">{orgName}</p>
            <PlanTag plan={plan} />
          </div>
        ) : null}

        {/* Collapsed, the toggle joins the footer group directly above the
            language button, so the three controls that are not navigation sit
            together. It first shipped below sign-out, at the very foot of the
            rail, where nobody looks. */}
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={t("Mở rộng điều hướng")}
            title={t("Mở rộng điều hướng")}
            className="mb-1 flex h-10 w-full items-center justify-center rounded-xl text-ink-400 hover:bg-sand-100 hover:text-ink-700"
          >
            <span className="rotate-180">
              <Icon name="chevrons" />
            </span>
          </button>
        ) : null}

        {/* The language switch is a form rather than a link: it writes a cookie
            and revalidates the layout, and a GET that changes state is the
            kind of thing a prefetcher will trigger on hover. */}
        <form action={setLocale}>
          <input type="hidden" name="locale" value={locale === "vi" ? "en" : "vi"} />
          <button
            type="submit"
            title={collapsed ? t("Ngôn ngữ") : undefined}
            className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900 ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <Icon name="globe" />
            {!collapsed ? (
              <span className="truncate">
                {t("Ngôn ngữ")}
                <span className="ml-1 font-normal text-ink-400">
                  {locale === "vi" ? "VI" : "EN"}
                </span>
              </span>
            ) : null}
          </button>
        </form>

        <form action={signOut}>
          <button
            type="submit"
            title={collapsed ? t("Đăng xuất") : undefined}
            className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-ink-500 transition-colors hover:bg-sand-100 hover:text-ink-900 ${
              collapsed ? "justify-center px-0" : ""
            }`}
          >
            <Icon name="logout" />
            {!collapsed ? <span className="truncate">{t("Đăng xuất")}</span> : null}
          </button>
        </form>
      </div>
    </nav>
  );
}

/**
 * Which plan this workspace is on, in the rail's footer.
 *
 * Beside the organization's name rather than buried in settings, because
 * "why can I not add another property" is a question the answer to should be
 * visible from wherever it gets asked — which is anywhere.
 *
 * It names the plan *in force*, not the one stored. A subscription that ran
 * out on Tuesday says "Miễn phí", because that is what the software is
 * actually giving; saying "Professional" while refusing everything
 * Professional includes is how a host concludes the product is broken rather
 * than that their month ended.
 *
 * The warning tone is the whole point of the expiry half. A plan quietly
 * lapsing is the one state where the badge has something urgent to say, and
 * a badge that looks the same on the last day as on the first has nothing to
 * say at all.
 */
export type PlanBadge = {
  /** The plan in force, already resolved for lapse. */
  name: string;
  /**
   * Is this a plan somebody is paying for?
   *
   * Its own field rather than `name !== "Miễn phí"`: the tone is a fact about
   * the plan, and reading it off a display string means the badge turns the
   * wrong colour the day that string is rewritten. The first version keyed the
   * tone off whether the badge had a link, which made a free plan look paid
   * for every owner and muted for everyone else — two wrong answers from a
   * field that was never about money.
   */
  paid: boolean;
  /** Days until it runs out. Null when it does not. */
  daysLeft: number | null;
  /** A paid plan that has already run out. */
  lapsed: boolean;
  /** Only an owner has anywhere to go from here. */
  href: string | null;
};

function PlanTag({ plan }: { plan: PlanBadge }) {
  const t = useT();

  const urgent = plan.lapsed || (plan.daysLeft !== null && plan.daysLeft <= 7);
  const tone = urgent
    ? "border-warning/30 bg-warning-soft text-warning"
    : plan.paid
      ? "border-clay-200 bg-clay-50 text-brand-dark"
      : "border-line bg-sand-100 text-ink-500";

  const label = plan.lapsed
    ? fill(t("{ten} · đã hết hạn"), { ten: t(plan.name) })
    : plan.daysLeft !== null && plan.daysLeft <= 7
      ? fill(t("{ten} · còn {n} ngày"), { ten: t(plan.name), n: plan.daysLeft })
      : t(plan.name);

  const className = `mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${tone}`;

  if (plan.href === null) {
    return <span className={className}>{label}</span>;
  }
  return (
    <Link href={plan.href} className={`${className} hover:brightness-95`}>
      {label}
    </Link>
  );
}
