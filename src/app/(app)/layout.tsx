import Link from "next/link";
import type { ReactNode } from "react";

import { requireMember } from "@/lib/dal";
import { signOut } from "../(auth)/actions";

/**
 * The signed-in shell. requireMember() runs here, so every page in this group
 * is behind it — but each page and action calls it again for its own data,
 * because a layout is not a security boundary: it does not re-run for every
 * navigation, and a server action reached directly never passes through it.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const member = await requireMember();

  return (
    <>
      <a
        href="#noi-dung"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-[14px] focus:text-sand-100"
      >
        Tới nội dung chính
      </a>

      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-5">
          <div className="flex items-center gap-6">
            <Link href="/lich" className="text-[15px] font-bold text-ink-900">
              TLSHost
            </Link>
            <nav aria-label="Chính" className="flex items-center gap-1">
              <Link
                href="/lich"
                className="flex min-h-11 items-center rounded-full px-3 text-[14px] font-medium text-ink-700 hover:bg-ink-100"
              >
                Lịch
              </Link>
              <Link
                href="/cho-nghi"
                className="flex min-h-11 items-center rounded-full px-3 text-[14px] font-medium text-ink-700 hover:bg-ink-100"
              >
                Chỗ nghỉ
              </Link>
              <Link
                href="/kenh"
                className="flex min-h-11 items-center rounded-full px-3 text-[14px] font-medium text-ink-700 hover:bg-ink-100"
              >
                Kênh bán
              </Link>
              <Link
                href="/doi-ngu"
                className="flex min-h-11 items-center rounded-full px-3 text-[14px] font-medium text-ink-700 hover:bg-ink-100"
              >
                Đội ngũ
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block text-[13px] font-medium text-ink-900">
                {member.userName}
              </span>
              <span className="block text-[11px] text-ink-500">{member.orgName}</span>
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="flex min-h-11 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-ink-100"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </header>

      <main id="noi-dung" className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">
        {children}
      </main>
    </>
  );
}
