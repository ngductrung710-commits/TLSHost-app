import type { Locale } from "@/lib/i18n";

/**
 * The way back to the marketing site.
 *
 * The mirror of src/lib/links.ts in the tlshost repo, which points that site
 * at this application. The two halves are separate builds on separate
 * hostnames, so neither can route to the other — each holds the other's URL in
 * an environment variable, and each falls back to rendering no link at all.
 *
 * Null rather than a guess, for the reason the other file gives: a link that
 * lands on nothing is worse than no link. Locally that means running both dev
 * servers; in production it means one line in .env.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || null;

/**
 * The marketing site in this reader's language, or null when it is not
 * configured.
 *
 * The locale is part of the path rather than negotiated at the far end,
 * because that site is route-based: /vi and /en are two URLs, not one URL
 * with a cookie. Sending a guest reading in English to the Vietnamese home
 * page would undo the language they just chose.
 */
export function siteUrl(locale: Locale): string | null {
  if (!SITE_URL) return null;
  return `${SITE_URL.replace(/\/+$/, "")}/${locale}`;
}

/**
 * Điều khoản và chính sách riêng tư, nằm trên trang giới thiệu.
 *
 * Chúng ở bên đó chứ không ở đây vì người đọc chúng chưa chắc đã có tài khoản
 * — và một trang pháp lý chỉ mở được sau khi đăng nhập thì đâu còn là công
 * khai nữa.
 *
 * Trả về null khi chưa cấu hình trang giới thiệu, cùng lý do như siteUrl:
 * không có liên kết còn hơn một liên kết dẫn tới hư không. Chỗ gọi phải xử lý
 * trường hợp đó chứ không được lờ đi — form đăng ký vẫn phải nói ra rằng có
 * điều khoản, kể cả khi chưa trỏ tới được.
 */
export function legalUrls(
  locale: Locale,
): { terms: string; privacy: string } | null {
  const base = siteUrl(locale);
  if (!base) return null;
  return { terms: base + "/terms", privacy: base + "/privacy" };
}
