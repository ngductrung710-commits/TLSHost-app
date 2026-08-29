"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canManageBookings, requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { LIMIT_MESSAGES } from "@/lib/plans";
import { runSync } from "@/lib/sync";
import { newToken } from "@/lib/tokens";
import { getT } from "@/lib/locale";

export type ChannelState = { error: string | null; notice?: string };

const connectSchema = z.object({
  roomId: z.string().min(1),
  kind: z.enum(["AIRBNB", "BOOKING_COM", "AGODA", "TRAVELOKA", "OTHER"]),
  importUrl: z.string().trim().url("Link iCal chưa đúng định dạng."),
  label: z.string().trim(),
});

export async function connectChannel(
  _prev: ChannelState,
  formData: FormData,
): Promise<ChannelState> {
  const t = await getT();
  const member = await requireMember();
  if (member.role !== "OWNER") {
    return { error: t("Chỉ chủ nhà mới kết nối được kênh.") };
  }
  if (!member.limits.channels) {
    return { error: LIMIT_MESSAGES.channels };
  }

  const parsed = connectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("Thông tin chưa hợp lệ.") };
  }

  const { roomId, kind, importUrl, label } = parsed.data;

  // An OTA feed is fetched by the server on a schedule, so a URL pointing at
  // the machine's own network is a request the host could never make
  // themselves. Refuse the obvious shapes rather than hand a stranger's link
  // to fetch().
  const url = new URL(importUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: t("Link phải bắt đầu bằng http:// hoặc https://") };
  }
  if (
    /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|\[?::1)/i.test(url.hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(url.hostname)
  ) {
    return { error: t("Link này trỏ vào mạng nội bộ, không dùng được.") };
  }

  try {
    await withOrg(member.orgId, async (tx) => {
      const room = await tx.room.findUnique({
        where: { id: roomId },
        select: { id: true },
      });
      if (!room) throw new Error("ROOM_NOT_FOUND");

      await tx.channel.create({
        data: {
          orgId: member.orgId,
          roomId,
          kind,
          importUrl,
          label: label || null,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ROOM_NOT_FOUND") {
      return { error: t("Không tìm thấy phòng này.") };
    }
    // The (roomId, kind) pair is unique: one Airbnb feed per room is all that
    // can mean anything.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    ) {
      return { error: t("Phòng này đã kết nối kênh đó rồi.") };
    }
    throw error;
  }

  revalidatePath("/kenh");
  return { error: null, notice: t("Đã kết nối. Bấm Đồng bộ ngay để kéo lịch về.") };
}

export async function syncNow(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (!canManageBookings(member)) return;
  // A lapsed subscription stops pulling. The channel row and its blocks stay —
  // deleting them would free nights an OTA has genuinely sold.
  if (!member.limits.channels) return;

  const channelId = String(formData.get("channelId") ?? "");
  if (!channelId) return;

  await runSync({ orgId: member.orgId, channelId });

  revalidatePath("/kenh");
  revalidatePath("/lich");
}

export async function disconnectChannel(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (member.role !== "OWNER") return;

  const channelId = String(formData.get("channelId") ?? "");
  if (!channelId) return;

  // The blocks this channel imported go with it, by cascade. That is correct:
  // they described nights the OTA was holding, and once the connection is gone
  // nothing here can tell whether they are still held. Leaving them would
  // block a room forever with no way to find out why.
  await withOrg(member.orgId, (tx) =>
    tx.channel.deleteMany({ where: { id: channelId } }),
  );

  revalidatePath("/kenh");
  revalidatePath("/lich");
}

/** Issues the room's export feed URL, or returns the existing one. */
export async function enableFeed(formData: FormData): Promise<void> {
  const member = await requireMember();
  if (member.role !== "OWNER") return;

  const roomId = String(formData.get("roomId") ?? "");
  if (!roomId) return;

  await withOrg(member.orgId, async (tx) => {
    const room = await tx.room.findUnique({
      where: { id: roomId },
      select: { id: true, icalToken: true },
    });
    if (!room || room.icalToken) return;

    await tx.room.update({
      where: { id: room.id },
      data: { icalToken: newToken() },
    });
  });

  revalidatePath("/kenh");
}
