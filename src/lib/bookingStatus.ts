/**
 * Vòng đời của một lượt đặt: nhãn, màu, và những bước đi tiếp được.
 *
 * Một module thường (không "server-only") vì cả thanh trên lịch (client) lẫn
 * trang chi tiết (server) đều đọc nó. Màu để thẳng dạng hex chứ không mượn
 * bảng màu clay/sand của app: đây là màu theo trạng thái, giống bản thiết kế
 * — hổ phách cho "chờ", teal cho "đã xác nhận" — và một cái đơn đọc lên phải
 * cùng màu ở mọi nơi nó xuất hiện.
 */

export type BookingStatusName =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "NO_SHOW"
  | "CANCELLED";

/** Nhãn tiếng Việt, đúng chữ bản thiết kế dùng. */
export const STATUS_LABEL: Record<BookingStatusName, string> = {
  PENDING: "Chờ xử lý",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã nhận phòng",
  CHECKED_OUT: "Đã trả phòng",
  NO_SHOW: "Vắng mặt",
  CANCELLED: "Đã hủy",
};

/** Màu của thanh trên lịch: nền, chữ, viền. */
export const STATUS_BAR: Record<
  BookingStatusName,
  { bg: string; fg: string; border: string }
> = {
  // Hổ phách #FFB400 với chữ mực — đúng cặp màu đọc được từ bản thiết kế.
  PENDING: { bg: "#FFB400", fg: "#101010", border: "#E0A000" },
  // Teal #008489, cũng lấy từ bản thiết kế.
  CONFIRMED: { bg: "#008489", fg: "#FFFFFF", border: "#006C70" },
  CHECKED_IN: { bg: "#059669", fg: "#FFFFFF", border: "#047857" },
  CHECKED_OUT: { bg: "#64748B", fg: "#FFFFFF", border: "#475569" },
  NO_SHOW: { bg: "#F43F5E", fg: "#FFFFFF", border: "#E11D48" },
  CANCELLED: { bg: "#E2E8F0", fg: "#475569", border: "#CBD5E1" },
};

/** Màu của viên nhãn trạng thái trong thẻ: nền nhạt, chữ đậm màu. */
export const STATUS_PILL: Record<BookingStatusName, { bg: string; fg: string }> = {
  PENDING: { bg: "#FFF4D6", fg: "#92610A" },
  CONFIRMED: { bg: "#D7EEEF", fg: "#006C70" },
  CHECKED_IN: { bg: "#D1FAE5", fg: "#047857" },
  CHECKED_OUT: { bg: "#E2E8F0", fg: "#475569" },
  NO_SHOW: { bg: "#FFE4E6", fg: "#E11D48" },
  CANCELLED: { bg: "#F1F5F9", fg: "#64748B" },
};

/**
 * Bước đi tiếp từ mỗi trạng thái, theo đúng những nút bản thiết kế bày ra.
 *
 * "Ghi nhận thanh toán" và "Mở" không nằm ở đây: cái đầu chỉ hiện khi còn nợ,
 * cái sau luôn có — chúng do chính thẻ quyết định. Bảng này chỉ nói về việc
 * dời trạng thái.
 */
export const NEXT_ACTIONS: Record<
  BookingStatusName,
  { to: BookingStatusName; label: string }[]
> = {
  PENDING: [{ to: "CONFIRMED", label: "Xác nhận" }],
  CONFIRMED: [
    { to: "CHECKED_IN", label: "Nhận phòng" },
    { to: "NO_SHOW", label: "Vắng mặt" },
  ],
  CHECKED_IN: [{ to: "CHECKED_OUT", label: "Trả phòng" }],
  CHECKED_OUT: [],
  NO_SHOW: [],
  CANCELLED: [],
};

/**
 * Mã đơn người đọc được, kiểu "HOM0001": ba chữ đầu tên cơ sở, viết hoa, cộng
 * số thứ tự đệm cho đủ bốn chữ số. Chưa có số thì trả null — thà không hiện mã
 * còn hơn hiện một mã bịa.
 */
export function bookingCode(propertyName: string, ref: number | null): string | null {
  if (ref === null) return null;
  const letters = propertyName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  const prefix = (letters.slice(0, 3) || "TLS").padEnd(3, "X");
  return `${prefix}${String(ref).padStart(4, "0")}`;
}

/** Có tính là một đêm đã bán không. Vắng mặt và đã hủy thì không. */
export function countsAsSold(status: string): boolean {
  return status !== "NO_SHOW" && status !== "CANCELLED";
}
