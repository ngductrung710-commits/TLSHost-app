/**
 * Turns a property name into a URL segment.
 *
 * Vietnamese needs two passes, not one. NFD splits a letter from its
 * diacritics so the marks can be stripped as a range — but d-with-stroke is not
 * a d carrying a mark, it is a separate letter, and it survives normalisation
 * untouched. Without the explicit pair below, a name beginning with it comes
 * out headless: the letter falls through to the non-alphanumeric pass and the
 * slug starts with a hyphen instead.
 *
 * Every non-ASCII character here is written as an escape. Unattached combining
 * marks are invisible in most editors and get rewritten by anything that
 * re-normalises the file, which turns a working regex into one that silently
 * matches nothing — and a slug function that silently stops stripping marks
 * produces URLs that look fine until someone tries to type one.
 *
 * Lives in its own module because it is not async, and a "use server" file may
 * only export async functions.
 *
 * Verified against real names: "Đà Nẵng" gives "da-nang",
 * "Nhà Đỗ Quyên — Đà Lạt" gives
 * "nha-do-quyen-da-lat", and a blank name gives an empty string rather than a
 * row of hyphens.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // the split-off diacritics
    .replace(/đ/g, "d") // d with stroke
    .replace(/Đ/g, "D") // D with stroke
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
