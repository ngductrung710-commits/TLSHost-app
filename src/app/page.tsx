import { redirect } from "next/navigation";

import { getActiveMember } from "@/lib/dal";

/**
 * The root has nothing of its own to show: signed in, the calendar is the
 * home screen; signed out, there is nothing to see at all.
 */
export default async function RootPage() {
  const member = await getActiveMember();
  redirect(member ? "/lich" : "/dang-nhap");
}
