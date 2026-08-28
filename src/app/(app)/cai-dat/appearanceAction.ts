"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { writeAppearance } from "@/lib/appearance";
import { requireMember } from "@/lib/dal";

const schema = z.object({ appearance: z.enum(["light", "dark", "system"]) });

/**
 * Light, dark or follow the device.
 *
 * Per device, not per organization: a host on a phone at night and a manager
 * on a desktop at noon want different answers and share one business. Stored
 * in a cookie so the server can render the right one on the first paint.
 *
 * Its own module because it belongs to no organization — everything in
 * actions.ts writes tenant data, and mixing a device preference in there
 * invites someone to give it an orgId later.
 */
export async function setAppearance(formData: FormData): Promise<void> {
  // Any signed-in person, including a housekeeper: this changes nothing but
  // what their own screen looks like.
  await requireMember();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await writeAppearance(parsed.data.appearance);
  revalidatePath("/", "layout");
}
