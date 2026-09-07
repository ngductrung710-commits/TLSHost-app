import { fill, type T } from "@/lib/i18n";

/**
 * Các cột chính sách của một cơ sở, đổi thành những câu khách đọc được.
 *
 * Ở một chỗ chứ không viết thẳng trong trang, vì đúng những câu này còn phải
 * đi vào thư xác nhận và vào trang quản lý. Ba bản chép tay sẽ có ngày nói ba
 * điều hơi khác nhau về cùng một quy định.
 *
 * Cột null bị bỏ qua hoàn toàn — không sinh ra dòng nào. "Chưa đặt" là câu
 * chủ nhà chưa trả lời, và in nó ra cho khách đọc là biến sự im lặng thành
 * một lời tuyên bố.
 */

export type PropertyPolicies = {
  checkInFrom: string | null;
  checkOutBy: string | null;
  smokingPolicy: string | null;
  petsPolicy: string | null;
  eventsPolicy: string | null;
  photographyPolicy: string | null;
  childrenPolicy: string | null;
  quietHoursFrom: string | null;
  quietHoursTo: string | null;
  depositNote: string | null;
};

/**
 * Mỗi quy định một câu hoàn chỉnh, không phải "Thú cưng: Cho phép".
 *
 * Dạng nhãn-hai-chấm-giá-trị đọc như một bảng cơ sở dữ liệu. Khách đang đọc
 * một trang bán hàng, và "Cho phép mang thú cưng." là câu tiếng Việt còn
 * "Thú cưng: Cho phép" thì không hẳn.
 */
const SENTENCES: Record<string, Record<string, string>> = {
  smokingPolicy: {
    ALLOWED: "Được hút thuốc.",
    NOT_ALLOWED: "Không hút thuốc, kể cả thuốc lá điện tử.",
  },
  petsPolicy: {
    ALLOWED: "Được mang thú cưng.",
    NOT_ALLOWED: "Không mang thú cưng.",
  },
  eventsPolicy: {
    ON_REQUEST: "Tiệc và sự kiện cần hỏi chủ nhà trước.",
    NOT_ALLOWED: "Không tổ chức tiệc hay sự kiện.",
  },
  photographyPolicy: {
    ON_REQUEST: "Chụp ảnh thương mại cần hỏi chủ nhà trước.",
    NOT_ALLOWED: "Không chụp ảnh thương mại.",
  },
  childrenPolicy: {
    SUITABLE: "Phù hợp với trẻ em và em bé.",
    NOT_SUITABLE: "Chỗ nghỉ này không phù hợp với trẻ em và em bé.",
  },
};

export function policyLines(p: PropertyPolicies, t: T): string[] {
  const out: string[] = [];

  // Hai mốc giờ gộp thành một câu khi có cả hai, vì đó là cách người ta nói.
  if (p.checkInFrom && p.checkOutBy) {
    out.push(
      fill(t("Nhận phòng từ {a}, trả phòng trước {b}."), {
        a: p.checkInFrom,
        b: p.checkOutBy,
      }),
    );
  } else if (p.checkInFrom) {
    out.push(fill(t("Nhận phòng từ {a}."), { a: p.checkInFrom }));
  } else if (p.checkOutBy) {
    out.push(fill(t("Trả phòng trước {b}."), { b: p.checkOutBy }));
  }

  for (const key of [
    "smokingPolicy",
    "petsPolicy",
    "eventsPolicy",
    "photographyPolicy",
    "childrenPolicy",
  ] as const) {
    const value = p[key];
    const sentence = value ? SENTENCES[key]?.[value] : undefined;
    if (sentence) out.push(t(sentence));
  }

  if (p.quietHoursFrom && p.quietHoursTo) {
    out.push(
      fill(t("Giờ yên tĩnh từ {a} đến {b}."), {
        a: p.quietHoursFrom,
        b: p.quietHoursTo,
      }),
    );
  }

  // Ghi chú của chủ nhà đi cuối và không bị bọc thêm chữ nào: đây là câu họ
  // tự viết, không phải một lựa chọn được dịch ra.
  if (p.depositNote) out.push(p.depositNote);

  return out;
}
