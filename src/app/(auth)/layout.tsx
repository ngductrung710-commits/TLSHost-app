import type { ReactNode } from "react";

import { siteUrl } from "@/lib/links";
import { readLocale } from "@/lib/locale";

/**
 * The shell around sign-in and sign-up: a centred card on the app's ground.
 * These are the only two pages that render without a session, so they are the
 * only ones that do not carry the calendar's chrome.
 *
 * They are also the only place in the application someone can arrive without
 * being a customer yet — a bookmark, a link from a colleague, a search result
 * — so this is where the way back to the marketing site belongs. Everywhere
 * else is behind a session, and someone signed in does not need to be told
 * what the product is.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const locale = await readLocale();
  const home = siteUrl(locale);

  const wordmark = (
    <span className="text-[15px] font-semibold tracking-tight text-ink-900">
      TLS<span className="font-normal text-ink-500">Host</span>
    </span>
  );

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">
        {/* A link when there is somewhere to go, plain text when there is not.
            The marketing site is a separate build on another hostname; if it
            has not been named in the environment, a wordmark that looks
            clickable and is not is worse than one that never claimed to be. */}
        <p className="mb-7">
          {home ? (
            <a href={home} className="inline-block hover:opacity-70">
              {wordmark}
            </a>
          ) : (
            wordmark
          )}
        </p>

        {children}
      </div>
    </main>
  );
}
