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
};

export const PLANS: Record<Plan, PlanLimits> = {
  FREE: {
    name: "Khởi đầu",
    price: 0,
    maxProperties: 1,
    channels: false,
    assistant: false,
    team: false,
  },
  CHANNELS: {
    name: "Kênh bán",
    price: 290_000,
    maxProperties: null,
    channels: true,
    assistant: false,
    team: false,
  },
  PRO: {
    name: "Chuyên nghiệp",
    price: 690_000,
    maxProperties: null,
    channels: true,
    assistant: true,
    team: true,
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

/** Reasons a limit stopped something, in words a host can act on. */
export const LIMIT_MESSAGES = {
  properties: (max: number) =>
    `Gói hiện tại cho tối đa ${max} chỗ nghỉ. Nâng cấp để thêm chỗ nghỉ mới.`,
  channels: "Đồng bộ kênh OTA có từ gói Kênh bán trở lên.",
  assistant: "Trợ lý AI có ở gói Chuyên nghiệp.",
  team: "Mời cộng tác viên và phân quyền có ở gói Chuyên nghiệp.",
} as const;
