import type { ReactNode } from "react";

/**
 * The shell around sign-in and sign-up: a centred card on the app's ground.
 * These are the only two pages that render without a session, so they are the
 * only ones that do not carry the calendar's chrome.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
