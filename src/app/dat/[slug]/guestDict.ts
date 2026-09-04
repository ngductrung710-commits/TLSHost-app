import { dictFor } from "@/lib/locale";

import type { Dict, Locale } from "@/lib/i18n";

/**
 * The handful of strings the guest pages need on the client.
 *
 * The workspace hands I18nProvider the whole dictionary, and on the workspace
 * that is right: it is behind a sign-in, a person keeps it open all day, and
 * one payload covers every screen they will visit.
 *
 * A booking page is the opposite of all three. It is the one page in this
 * product a stranger reaches, often on a phone, often on mobile data, and
 * often once. Handing it the whole dictionary took the English page from 34 KB
 * to 86 KB — fifty-two kilobytes of workspace copy, none of which that page
 * can render, so that two small forms could translate fourteen strings.
 *
 * So the list is written out. It has to be maintained, which is why
 * check:i18n verifies it against the client components themselves: a key used
 * there and missing here fails, and a key here that nothing uses fails too.
 * A list nobody checks is worse than no list.
 */
export const GUEST_CLIENT_KEYS = [
  "(không bắt buộc)",
  "Bạn vẫn giữ phòng — có thể trả khi nhận phòng.",
  "Bỏ chọn phòng này",
  "Chọn phòng này",
  "Công ty",
  "Ghi chú cho chủ nhà",
  "Số khách",
  "Thanh toán qua {cong}",
  "Tên của bạn",
  "thẻ",
  "Đang gửi…",
  "Đang mở trang thanh toán…",
  "Điện thoại",
  "Đặt phòng này",
] as const;

export function guestClientDict(locale: Locale): Dict {
  const full = dictFor(locale);
  const out: Dict = {};
  for (const key of GUEST_CLIENT_KEYS) {
    const value = full[key];
    // Missing is not an error here. Vietnamese has no dictionary at all, and a
    // key with no translation renders as itself, which is the same fallback
    // makeT() applies anyway.
    if (value !== undefined) out[key] = value;
  }
  return out;
}
