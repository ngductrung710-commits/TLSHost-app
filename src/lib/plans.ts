/**
 * What each plan allows.
 *
 * One table, and every limit in the app reads from it. The alternative —
 * scattering `if (plan === "PRO")` through the pages that need it — produces
 * a product where the pricing page and the software disagree, and the person
 * who finds out is a host who paid for something they did not get.
 *
 * The numbers match the marketing site's pricing page exactly. If one changes,
 * both change, and check:plans will say so.
 */

export type Plan = "FREE" | "CHANNELS" | "PRO";

export type PlanLimits = {
  name: string;
  /** Monthly price in whole dong. 0 for the free plan. */
  price: number;
  /** null means no limit. */
  maxProperties: number | null;
  /** Two-way iCal sync with the OTAs. */
  channels: boolean;
  /** The drafting assistant. */
  assistant: boolean;
  /** Inviting collaborators and housekeepers with scoped access. */
  team: boolean;
  /**
   * What the plan card lists, in the plan's own words.
   *
   * Written out rather than derived from the flags above. The flags say what
   * the software allows; this says what a host is being sold, and the two are
   * not the same sentence — "channels: true" is not "Airbnb, Booking.com,
   * Agoda & nhiều kênh khác", and a card generated from booleans reads like a
   * permissions matrix.
   *
   * Identical to the marketing site's list, word for word, and check:plans
   * fails when they drift. Two places describing the same purchase in
   * different words is how a host ends up feeling misled by a product that is
   * doing exactly what it said.
   *
   * Each paid plan opens by naming the one below it, so the list is read as
   * cumulative rather than as a replacement.
   */
  features: readonly string[];
};

export const PLANS: Record<Plan, PlanLimits> = {
  FREE: {
    name: "Miễn phí",
    price: 0,
    maxProperties: 1,
    channels: false,
    assistant: false,
    team: false,
    features: [
      "Một chỗ nghỉ",
      "Lịch đặt phòng và kho phòng",
      "Trang đặt phòng trực tiếp của bạn",
      "Không hoa hồng đặt phòng",
    ],
  },
  CHANNELS: {
    // English, on purpose: this is the name hosts already use for the thing.
    // "Kênh bán" is what the sidebar calls the screen, and the sidebar is
    // about a feature — the plan is a product, and every host who has
    // shopped for one has read "channel manager".
    name: "Channel Manager",
    price: 290_000,
    maxProperties: null,
    channels: true,
    assistant: false,
    team: false,
    features: [
      "Mọi thứ trong gói Miễn phí",
      "Đồng bộ kênh OTA hai chiều",
      "Airbnb, Booking.com, Agoda và nhiều kênh khác",
      "Tự động đồng bộ tình trạng phòng từng giờ",
      "Nhiều chỗ nghỉ",
    ],
  },
  PRO: {
    name: "Professional",
    price: 690_000,
    maxProperties: null,
    channels: true,
    assistant: true,
    team: true,
    features: [
      "Mọi thứ trong gói Channel Manager",
      "Trợ lý AI vận hành",
      "Thành viên và phân quyền theo phạm vi",
      "Theo dõi người tạo đặt phòng",
      "Dọn phòng và số liệu tổng quan",
    ],
  },
};

export const PLAN_ORDER: Plan[] = ["FREE", "CHANNELS", "PRO"];

/**
 * The plan actually in force.
 *
 * A lapsed subscription falls back to FREE rather than staying on what was
 * paid for. Nothing is deleted — a host over the property limit keeps every
 * property and simply cannot add another until they renew. Taking data away
 * to enforce a limit would be the wrong trade in every direction.
 */
export function effectivePlan(plan: Plan, planUntil: Date | null): Plan {
  if (plan === "FREE") return "FREE";
  if (planUntil === null) return plan;
  return planUntil > new Date() ? plan : "FREE";
}

export function limitsFor(plan: Plan, planUntil: Date | null): PlanLimits {
  return PLANS[effectivePlan(plan, planUntil)];
}

/** The cheapest plan that includes a given feature — what an upsell points at. */
export function cheapestWith(feature: "channels" | "assistant" | "team"): Plan {
  return PLAN_ORDER.find((p) => PLANS[p][feature]) ?? "PRO";
}

/**
 * Reasons a limit stopped something, in words a host can act on.
 *
 * Keys, not finished sentences. The property one used to be a function
 * returning a template literal, which meant the one message with a number in
 * it was the one message that could never be translated: t() looks the string
 * up after the number is already in it, so nothing matched, and an English
 * workspace showed a Vietnamese sentence. check:i18n did not see it either —
 * it reads quoted literals, and a backtick is not a quote.
 *
 * So the number goes in with fill() at the call site, after translation.
 */
export const LIMIT_MESSAGES = {
  properties: "Gói hiện tại cho tối đa {n} cơ sở. Nâng cấp để thêm cơ sở mới.",
  channels: "Đồng bộ kênh OTA có từ gói Kênh bán trở lên.",
  assistant: "Trợ lý AI có ở gói Chuyên nghiệp.",
  team: "Mời cộng tác viên và phân quyền có ở gói Chuyên nghiệp.",
} as const;
