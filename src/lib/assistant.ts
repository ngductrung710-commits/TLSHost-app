import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { visiblePropertyFilter, type ActiveMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { addDays, formatVnd, toIsoDate } from "@/lib/dates";
import { assistantReplySchema, type AssistantReply } from "@/lib/proposals";

/**
 * The assistant: reads, drafts, and stops.
 *
 * It has no write path. It is handed a snapshot of what the host can already
 * see, and returns one structured proposal that the approval code applies —
 * through the same availability check and the same constraints a host's own
 * click goes through. Tool use was the other option and was not taken: a model
 * that can call `create_booking` is a model that has written to the calendar
 * before anyone looked at what it did, and "AI đề xuất, bạn duyệt" is the
 * product, not a setting.
 *
 * The snapshot is also the boundary. It is built inside withOrg from the
 * member's own scope, so a collaborator's assistant cannot see a property they
 * were not given, and there is nothing in the prompt that could widen it.
 */

const MODEL = "claude-opus-5";

/** Days of calendar the assistant is shown. Enough to answer, small enough to cache. */
const WINDOW_DAYS = 60;

export type AssistantOutcome =
  | { ok: true; reply: AssistantReply }
  | { ok: false; error: string };

/**
 * Everything the model gets to see, as text.
 *
 * Ids are included because a proposal has to name a room, and the model cannot
 * invent one that will pass validation — the approval path checks every id
 * against the database again. They are not shown to the host.
 */
async function buildSnapshot(
  member: ActiveMember,
  today: Date,
): Promise<string> {
  const until = addDays(today, WINDOW_DAYS);

  return withOrg(member.orgId, async (tx) => {
    const rooms = await tx.room.findMany({
      where: { property: visiblePropertyFilter(member) },
      select: {
        id: true,
        name: true,
        capacity: true,
        basePrice: true,
        property: { select: { name: true } },
      },
      orderBy: [{ property: { name: "asc" } }, { name: "asc" }],
    });

    if (rooms.length === 0) return "Chưa có phòng nào.";

    const roomIds = rooms.map((r) => r.id);

    const bookings = await tx.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { not: "CANCELLED" },
        checkOut: { gt: today },
        checkIn: { lt: until },
      },
      select: {
        id: true,
        roomId: true,
        guestName: true,
        checkIn: true,
        checkOut: true,
        guests: true,
        source: true,
      },
      orderBy: { checkIn: "asc" },
    });

    const blocks = await tx.block.findMany({
      where: { roomId: { in: roomIds }, dateTo: { gt: today }, dateFrom: { lt: until } },
      select: { id: true, roomId: true, dateFrom: true, dateTo: true, reason: true },
      orderBy: { dateFrom: "asc" },
    });

    const lines: string[] = [];

    lines.push(`Hôm nay: ${toIsoDate(today)} (múi giờ ${member.timezone})`);
    lines.push("");
    lines.push("PHÒNG");
    for (const r of rooms) {
      lines.push(
        `- id=${r.id} | ${r.property.name} — ${r.name} | tối đa ${r.capacity} khách | ` +
          (r.basePrice === null ? "chưa đặt giá" : `${formatVnd(r.basePrice)}/đêm`),
      );
    }

    lines.push("");
    lines.push(`ĐẶT PHÒNG ${WINDOW_DAYS} NGÀY TỚI`);
    if (bookings.length === 0) lines.push("- (không có)");
    for (const b of bookings) {
      lines.push(
        `- id=${b.id} | phòng=${b.roomId} | ${b.guestName} | ` +
          `${toIsoDate(b.checkIn)} → ${toIsoDate(b.checkOut)} | ${b.guests} khách | ${b.source}`,
      );
    }

    lines.push("");
    lines.push("ĐÊM ĐANG KHÓA");
    if (blocks.length === 0) lines.push("- (không có)");
    for (const b of blocks) {
      lines.push(
        `- id=${b.id} | phòng=${b.roomId} | ${toIsoDate(b.dateFrom)} → ${toIsoDate(b.dateTo)} | ${b.reason}`,
      );
    }

    return lines.join("\n");
  });
}

const SYSTEM = `Bạn là trợ lý vận hành của TLSHost, phần mềm quản lý chỗ nghỉ cho chủ nhà ở Việt Nam.

Chủ nhà mô tả một việc bằng lời thường ngày. Bạn soạn đúng MỘT đề xuất thay đổi, không hơn. Bạn không bao giờ tự thực hiện — chủ nhà sẽ đọc rồi bấm duyệt.

Quy tắc:
- Ngày ghi theo YYYY-MM-DD. Ngày trả phòng là ngày khách rời đi: ở từ 12 đến 15 nghĩa là checkIn 12, checkOut 15, tức 3 đêm.
- Chỉ dùng id phòng và id đặt phòng có trong dữ liệu được cung cấp. Không bịa id.
- Nếu yêu cầu mơ hồ, thiếu thông tin, nhắc tới phòng không tồn tại, hoặc nằm ngoài những việc bạn làm được, hãy trả về kind NONE và nói rõ còn thiếu gì.
- Nếu những đêm được yêu cầu đã có người giữ, vẫn cứ soạn đề xuất. Hệ thống sẽ từ chối và nói rõ ai đang giữ — việc đó không phải của bạn.
- summary viết cho chủ nhà đọc: một câu tiếng Việt, nêu tên phòng và ngày, không có id.`;

export async function draftProposal({
  member,
  today,
  prompt,
}: {
  member: ActiveMember;
  today: Date;
  prompt: string;
}): Promise<AssistantOutcome> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error:
        "Chưa cấu hình ANTHROPIC_API_KEY, nên trợ lý chưa hoạt động. Xem README để biết cách thêm.",
    };
  }

  const client = new Anthropic();
  const snapshot = await buildSnapshot(member, today);

  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Adaptive thinking: working out which room is free on which nights from
      // a wall of rows is exactly the kind of thing worth thinking about, and
      // the host is waiting on one reply rather than a stream.
      thinking: { type: "adaptive" },
      output_config: { format: zodOutputFormat(assistantReplySchema) },
      system: [
        // The stable half first and cached: the instructions never change, so
        // every request after the first pays for the snapshot and the question
        // only.
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: `DỮ LIỆU HIỆN TẠI\n\n${snapshot}\n\nYÊU CẦU CỦA CHỦ NHÀ\n\n${prompt}`,
        },
      ],
    });

    // parsed_output is null when the model's output did not match the schema.
    // Treated as a failure rather than patched over: a half-understood proposal
    // is worse than none, because the next thing that happens is a person
    // approving it.
    if (!response.parsed_output) {
      return {
        ok: false,
        error: "Trợ lý không soạn được đề xuất hợp lệ. Thử mô tả lại rõ hơn.",
      };
    }

    return { ok: true, reply: response.parsed_output };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Trợ lý đang quá tải. Thử lại sau một phút." };
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "ANTHROPIC_API_KEY không hợp lệ." };
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return { ok: false, error: "Không kết nối được tới trợ lý. Kiểm tra mạng." };
    }
    throw error;
  }
}
