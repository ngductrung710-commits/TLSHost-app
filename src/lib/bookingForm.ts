/**
 * Những hằng số mà cả form đặt phòng lẫn server action đều cần biết.
 *
 * Một tệp riêng vì tệp actions.ts mang chỉ thị "use server", và một module như
 * thế chỉ được phép export hàm async — một hằng số đặt ở đó làm hỏng bản dựng.
 * Cùng lý do đã sinh ra propertyForm.ts và passwordRules.ts.
 */

/**
 * Giá trị của ô "Phòng được gán" khi để hệ thống tự chọn.
 *
 * Một chuỗi có chữ chứ không phải chuỗi rỗng: chuỗi rỗng là thứ trình duyệt
 * gửi lên khi một ô select không có lựa chọn nào, và "người dùng chọn tự động"
 * với "form hỏng" không nên trông giống nhau ở phía máy chủ.
 */
export const AUTO_ROOM = "auto";
