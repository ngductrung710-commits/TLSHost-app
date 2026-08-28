import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";

import { readAppearance } from "@/lib/appearance";

import "./globals.css";

/**
 * Be Vietnam Pro, same as the marketing site. Chosen there because it draws a
 * real Vietnamese diacritic set rather than stacking marks — at the sizes on
 * the board, where a room name and a guest name sit two pixels apart, that is
 * the difference between reading and guessing.
 */
const sans = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "TLSHost", template: "%s — TLSHost" },
  description: "Không gian vận hành cho chủ nhà độc lập.",
  // This is a private workspace, not a page anyone should reach from search.
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read on the server so the first paint is already right. Doing this in the
  // browser flashes the light theme on every navigation, which on a dark
  // setting is a white rectangle in a dark room.
  const appearance = await readAppearance();

  return (
    <html
      lang="vi"
      // Nothing stamped for "system": the CSS follows prefers-color-scheme
      // when no attribute is present, which is the behaviour that setting
      // names.
      data-theme={appearance === "system" ? undefined : appearance}
      className={`${sans.variable} h-full`}
    >
      <body className="flex min-h-full flex-col font-[family-name:var(--font-sans)]">
        {children}
      </body>
    </html>
  );
}
