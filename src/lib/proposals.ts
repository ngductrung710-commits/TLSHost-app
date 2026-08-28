import { z } from "zod";

/**
 * The shapes the assistant is allowed to propose.
 *
 * This file has no imports from the database or the SDK on purpose: it is the
 * contract between what the model returns and what the application will apply,
 * and both sides validate against it. The model's output is parsed with it, and
 * the approval path parses the stored JSON with it *again* rather than trusting
 * a row it wrote earlier — a proposal sits in a table for minutes, and a
 * migration or a hand-edit in between should fail closed.
 *
 * Every field is something a host could have typed themselves. There is
 * deliberately no free-form "sql" or "action" escape hatch: the set of things
 * the assistant can suggest is the set of things enumerated here, and widening
 * it is a code change someone reviews.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải theo dạng YYYY-MM-DD");

const bookingSource = z.enum([
  "DIRECT",
  "AIRBNB",
  "BOOKING_COM",
  "AGODA",
  "TRAVELOKA",
  "OTHER",
]);

export const proposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CREATE_BOOKING"),
    roomId: z.string().min(1),
    checkIn: isoDate,
    checkOut: isoDate,
    guestName: z.string().min(1),
    guestEmail: z.string().default(""),
    guestPhone: z.string().default(""),
    guests: z.number().int().min(1).max(50).default(2),
    source: bookingSource.default("DIRECT"),
    notes: z.string().default(""),
  }),
  z.object({
    kind: z.literal("BLOCK_NIGHTS"),
    roomId: z.string().min(1),
    dateFrom: isoDate,
    dateTo: isoDate,
    reason: z.enum(["MAINTENANCE", "OWNER_STAY", "OTHER"]).default("MAINTENANCE"),
    note: z.string().default(""),
  }),
  z.object({
    kind: z.literal("CANCEL_BOOKING"),
    bookingId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("MOVE_BOOKING"),
    bookingId: z.string().min(1),
    roomId: z.string().min(1),
    checkIn: isoDate,
    checkOut: isoDate,
  }),
  z.object({
    kind: z.literal("SET_PRICE"),
    roomId: z.string().min(1),
    /// Whole dong. Null clears the price rather than setting it to zero.
    basePrice: z.number().int().min(0).nullable(),
  }),
  z.object({
    kind: z.literal("NONE"),
    /// Why nothing can be proposed — a missing room, an ambiguous date, a
    /// request outside what the assistant can do.
    why: z.string().min(1),
  }),
]);

export type Proposal = z.infer<typeof proposalSchema>;

/**
 * What the model is asked to return: one proposal plus a sentence about it.
 *
 * The summary is separate from the payload because it is for a person and the
 * payload is for the machine. Asking for both in one field would mean parsing
 * prose to apply a change, which is the thing this design exists to avoid.
 */
export const assistantReplySchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe(
      "Một câu tiếng Việt mô tả đề xuất, viết cho chủ nhà đọc. Không dùng id.",
    ),
  proposal: proposalSchema,
});

export type AssistantReply = z.infer<typeof assistantReplySchema>;

/** Human labels for the proposal list and the preview. */
export const KIND_LABELS: Record<Proposal["kind"], string> = {
  CREATE_BOOKING: "Tạo đặt phòng",
  BLOCK_NIGHTS: "Khóa đêm",
  CANCEL_BOOKING: "Hủy đặt phòng",
  MOVE_BOOKING: "Dời đặt phòng",
  SET_PRICE: "Đặt giá phòng",
  NONE: "Không có gì để làm",
};

/** How long a proposal stays approvable. */
export const PROPOSAL_TTL_MS = 30 * 60 * 1000;
