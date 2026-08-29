import Link from "next/link";

import { getT } from "@/lib/locale";

/**
 * The assistant, as a tab clipped to the right edge of the window.
 *
 * It is here because the rail is not. Trimming the rail to six entries dropped
 * the assistant along with two other screens, and unlike those two nothing
 * replaced it — /tro-ly stayed in the build with no link anywhere in the app
 * pointing at it. A feature you cannot reach is not a feature.
 *
 * A tab rather than a floating circle: a circle sitting over the calendar
 * covers a room's row at exactly the width where the last column lives. Half a
 * pill hanging off the edge takes 39px and covers nothing.
 *
 * Hidden below md. On a phone the calendar already scrolls sideways, and a
 * fixed thing on the right edge is directly in the way of that gesture.
 */
export async function AssistantTab() {
  const t = await getT();

  return (
    <Link
      href="/tro-ly"
      aria-label={t("Mở trợ lý AI")}
      title={t("Mở trợ lý AI")}
      className="fixed right-0 top-1/2 z-35 hidden -translate-y-1/2 items-center rounded-l-full border border-r-0 border-line bg-ink-900 py-3 pl-3 pr-2 text-white shadow-lg transition-colors hover:bg-ink-800 md:flex"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 8V4H8" />
        <rect width="16" height="12" x="4" y="8" rx="2" />
        <path d="M2 14h2" />
        <path d="M20 14h2" />
        <path d="M15 13v2" />
        <path d="M9 13v2" />
      </svg>
    </Link>
  );
}
