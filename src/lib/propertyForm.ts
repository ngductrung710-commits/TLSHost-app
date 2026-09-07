import { keepKnownAmenities } from "@/lib/amenities";

/**
 * Những mảnh mà form tạo cơ sở và form sửa cơ sở đều cần.
 *
 * Chúng từng nằm riêng trong cho-nghi/actions.ts, chỗ duy nhất dùng tới. Giờ
 * có hai chỗ dùng, và chép sang chỗ thứ hai là cách chắc chắn nhất để một
 * ngày nào đó tạo và sửa hiểu địa chỉ theo hai kiểu khác nhau.
 *
 * Không để lại trong tệp "use server" được: tệp đó chỉ được phép xuất ra hàm
 * async, nên ba hàm đồng bộ này buộc phải có nhà riêng.
 */

/** CRLF của Windows về LF, để một dòng luôn là một dòng. */
export const lines = (text: string) => text.replaceAll("\r\n", "\n");

/**
 * Một dòng địa chỉ dựng từ các ô rời.
 *
 * Bỏ ô trống chứ không nối dấu phẩy rỗng — "153 Tự Phước, , Đà Lạt" là thứ
 * xuất hiện trên phong bì thật nếu không lọc.
 */
export function composeAddress(parts: {
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
}): string {
  return [
    parts.addressLine1,
    parts.addressLine2,
    parts.city,
    parts.region,
    parts.postalCode,
  ]
    .filter((p) => p !== "")
    .join(", ");
}

/**
 * Danh sách tiện nghi gửi lên dưới dạng JSON trong một ô ẩn.
 *
 * Hỏng thì trả về mảng rỗng chứ không ném lỗi: một danh sách tiện nghi méo
 * không đáng để mất cả thao tác lưu — chủ nhà mất mấy dấu tích, không mất cơ
 * sở. Và mọi id đều đi qua keepKnownAmenities, nên thứ gửi lên không nằm
 * trong danh mục sẽ bị bỏ chứ không được ghi vào cơ sở dữ liệu.
 */
export function parseAmenityIds(raw: FormDataEntryValue | null): string[] {
  try {
    const value: unknown = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(value)) return [];
    return keepKnownAmenities(value.filter((v): v is string => typeof v === "string"));
  } catch {
    return [];
  }
}
