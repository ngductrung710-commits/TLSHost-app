import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireMember } from "@/lib/dal";
import { getT, readLocale } from "@/lib/locale";

import { PropertyWizard } from "./PropertyWizard";
import { createProperty } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Thêm cơ sở") };
}

/**
 * The wizard covers the viewport, so this page has no heading of its own —
 * the panel carries its own header, rail and footer.
 *
 * The language is read here and handed down as a prop. Client components get
 * the dictionary through I18nProvider, but the dictionary cannot answer "which
 * language is this" — it is an empty object for Vietnamese — and the amenity
 * catalogue and country list are keyed by language rather than translated
 * through it.
 */
export default async function NewPropertyPage() {
  const member = await requireMember();
  if (member.role !== "OWNER") redirect("/cho-nghi");

  return <PropertyWizard action={createProperty} lang={await readLocale()} />;
}
