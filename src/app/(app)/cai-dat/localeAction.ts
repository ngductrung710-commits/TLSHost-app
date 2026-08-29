"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { writeLocale } from "@/lib/locale";

const schema = z.object({ locale: z.enum(["vi", "en"]) });

/**
 * Vietnamese or English, for this person on this device.
 *
 * Alongside setAppearance rather than in actions.ts, and for the same reason:
 * neither of them writes anything belonging to an organization. A collaborator
 * reading the workspace in English changes nothing for the host reading it in
 * Vietnamese, and nothing at all for a guest — the public booking page is in
 * the property's language, which is the host's decision, not a staff setting.
 */
export async function setLocale(formData: FormData): Promise<void> {
  // Any signed-in person, housekeepers included. This changes the words on
  // their own screen and nothing else.
  await requireMember();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;

  await writeLocale(parsed.data.locale);

  // The whole layout, not just this page: the navigation, the header and every
  // cached segment are all rendered in the old language until this runs.
  revalidatePath("/", "layout");
}
