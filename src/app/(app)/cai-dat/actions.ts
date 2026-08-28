"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { prisma, withOrg } from "@/lib/db";
import {
  hashPassword,
  passwordProblem,
  verifyPassword,
} from "@/lib/passwords";
import { createSession } from "@/lib/session";
import { TIMEZONES } from "@/lib/timezones";
import { brandColorProblem } from "@/lib/themes";
import { deleteLogo, saveLogo } from "@/lib/uploads";

export type SettingsState = { error: string | null; notice?: string };

const orgSchema = z.object({
  name: z.string().trim().min(1, "Tên cơ sở không được để trống."),
  timezone: z.enum(TIMEZONES),
});

export async function updateOrg(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const member = await requireMember();
  if (member.role !== "OWNER") {
    return { error: "Chỉ chủ nhà mới đổi được cài đặt cơ sở." };
  }

  const parsed = orgSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  await withOrg(member.orgId, (tx) =>
    tx.organization.update({
      where: { id: member.orgId },
      data: { name: parsed.data.name, timezone: parsed.data.timezone },
    }),
  );

  // The timezone decides what "today" is on every screen that shows a date.
  revalidatePath("/", "layout");
  return { error: null, notice: "Đã lưu." };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Tên không được để trống."),
});

export async function updateProfile(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const member = await requireMember();

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  // Not scoped to an org: a user belongs to the person, not the tenant, and
  // `user` is deliberately outside row-level security for exactly this reason.
  // Keyed on the session's own user id, which the client cannot forge.
  await prisma.user.update({
    where: { id: member.userId },
    data: { name: parsed.data.name },
  });

  revalidatePath("/", "layout");
  return { error: null, notice: "Đã lưu." };
}

const passwordSchema = z.object({
  current: z.string().min(1, "Nhập mật khẩu hiện tại."),
  next: z.string(),
});

export async function changePassword(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const member = await requireMember();

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const weak = passwordProblem(parsed.data.next);
  if (weak) return { error: weak };

  const user = await prisma.user.findUnique({
    where: { id: member.userId },
    select: { passwordHash: true },
  });

  // The current password is required even though the session already proves
  // identity: a borrowed laptop with an open tab should not be enough to lock
  // the owner out of their own account.
  if (!user?.passwordHash) {
    return { error: "Tài khoản này chưa đặt mật khẩu." };
  }
  if (!(await verifyPassword(user.passwordHash, parsed.data.current))) {
    return { error: "Mật khẩu hiện tại không đúng." };
  }

  const passwordHash = await hashPassword(parsed.data.next);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: member.userId },
      data: { passwordHash },
    });

    // Every session ends, including this one. Changing a password is what
    // someone does when they think it leaked, and a change that leaves the
    // intruder signed in does nothing. Second time server-side sessions have
    // paid for themselves — with a JWT there would be nothing to delete.
    await tx.session.deleteMany({ where: { userId: member.userId } });
  });

  // Then a fresh session for the person who just did this, so they are not
  // logged out of the tab they are standing in. Without it the notice below
  // would be a lie by omission: their next click would land on the sign-in
  // page with no explanation.
  await createSession(member.userId);

  return {
    error: null,
    notice:
      "Đã đổi mật khẩu. Mọi phiên đăng nhập khác đã bị đăng xuất; phiên này vẫn giữ.",
  };
}

/* -------------------------------------------------------------------------- */
/* Appearance                                                                  */
/* -------------------------------------------------------------------------- */

const appearanceSchema = z.object({
  bookingTheme: z.enum(["CLASSIC", "MINIMAL", "WARM", "BOLD"]),
  /** Empty means "use the preset's own accent", which is not the same as black. */
  brandColor: z.string().trim(),
});

export async function updateAppearance(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const member = await requireMember();
  if (member.role !== "OWNER") {
    return { error: "Chỉ chủ nhà mới đổi được giao diện." };
  }

  const parsed = appearanceSchema.safeParse({
    bookingTheme: formData.get("bookingTheme"),
    brandColor: formData.get("brandColor"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ." };
  }

  const { bookingTheme } = parsed.data;
  const raw = parsed.data.brandColor;

  // Checked here rather than at render. A host who picks a colour nobody can
  // read should be told by the form, in the same second, rather than find out
  // from a guest who could not see the button.
  if (raw !== "") {
    const problem = brandColorProblem(raw, bookingTheme);
    if (problem) return { error: problem };
  }

  await withOrg(member.orgId, (tx) =>
    tx.organization.update({
      where: { id: member.orgId },
      data: {
        bookingTheme,
        brandColor: raw === "" ? null : raw.toLowerCase(),
      },
    }),
  );

  revalidatePath("/cai-dat");
  return { error: null, notice: "Đã lưu giao diện trang đặt phòng." };
}

export async function uploadLogo(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const member = await requireMember();
  if (member.role !== "OWNER") {
    return { error: "Chỉ chủ nhà mới đổi được logo." };
  }

  const file = formData.get("logo");
  if (!(file instanceof File)) return { error: "Chưa chọn tệp nào." };

  const saved = await saveLogo(file);
  if (!saved.ok) return { error: saved.error };

  const previous = await withOrg(member.orgId, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: member.orgId },
      select: { logoFile: true },
    });
    await tx.organization.update({
      where: { id: member.orgId },
      data: { logoFile: saved.filename },
    });
    return org?.logoFile ?? null;
  });

  // Only after the row points at the new file. The other order leaves a window
  // where the page has no logo at all if the write fails.
  if (previous) await deleteLogo(previous);

  revalidatePath("/cai-dat");
  return { error: null, notice: "Đã tải logo lên." };
}

export async function removeLogo(): Promise<void> {
  const member = await requireMember();
  if (member.role !== "OWNER") return;

  const previous = await withOrg(member.orgId, async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: member.orgId },
      select: { logoFile: true },
    });
    await tx.organization.update({
      where: { id: member.orgId },
      data: { logoFile: null },
    });
    return org?.logoFile ?? null;
  });

  if (previous) await deleteLogo(previous);
  revalidatePath("/cai-dat");
}
