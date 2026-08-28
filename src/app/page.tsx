import { redirect } from "next/navigation";

import { getActiveMember } from "@/lib/dal";

/**
 * The root has nothing of its own to show: signed in, the dashboard is the
 * home screen; signed out, there is nothing to see at all.
 *
 * A housekeeper is bounced again from /tong-quan — they have no business on
 * it — which costs one extra redirect and keeps the role check in one place
 * rather than spread across every entry point.
 */
export default async function RootPage() {
  const member = await getActiveMember();
  redirect(member ? "/tong-quan" : "/dang-nhap");
}
