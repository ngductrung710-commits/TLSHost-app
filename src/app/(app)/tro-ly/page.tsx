import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { canManageBookings, orgCurrency, requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";
import { formatMoney, shortVi } from "@/lib/dates";
import { KIND_LABELS, proposalSchema } from "@/lib/proposals";

import { approve, reject } from "./actions";
import { getT, readLocale } from "@/lib/locale";
import { fill, type Locale, type T } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Trợ lý") };
}

/**
 * Renders a proposal as the change it would make.
 *
 * Deliberately not the model's own summary: the summary is prose the model
 * wrote, and the point of a preview is to show what will actually be applied.
 * If the two disagree, this is the one that is true.
 */
function preview(
  raw: unknown,
  rooms: Map<string, string>,
  t: T,
  locale: Locale,
  currency: string,
): string[] {
  const parsed = proposalSchema.safeParse(raw);
  if (!parsed.success) return [t("Không đọc được nội dung đề xuất.")];

  const p = parsed.data;
  const room = (id: string) => rooms.get(id) ?? t("phòng không còn tồn tại");

  // These lines are what a host reads before approving a write to their
  // calendar, so the label has to be in their language even though the value
  // beside it — a room name, a guest's name — never is.
  switch (p.kind) {
    case "CREATE_BOOKING":
      return [
        fill(t("Phòng: {ten}"), { ten: room(p.roomId) }),
        fill(t("Ngày: {tu} → {den}"), { tu: p.checkIn, den: p.checkOut }),
        fill(t("Khách: {ten}{sdt}"), {
          ten: p.guestName,
          sdt: p.guestPhone ? ` · ${p.guestPhone}` : "",
        }),
        fill(t("Số khách: {n} · Nguồn: {nguon}"), {
          n: p.guests,
          nguon: p.source,
        }),
        ...(p.notes ? [fill(t("Ghi chú: {noi}"), { noi: p.notes })] : []),
      ];
    case "BLOCK_NIGHTS":
      return [
        fill(t("Phòng: {ten}"), { ten: room(p.roomId) }),
        fill(t("Khóa: {tu} → {den}"), { tu: p.dateFrom, den: p.dateTo }),
        fill(t("Lý do: {ly}"), { ly: p.reason }),
        ...(p.note ? [fill(t("Ghi chú: {noi}"), { noi: p.note })] : []),
      ];
    case "CANCEL_BOOKING":
      return [fill(t("Hủy đặt phòng: {ma}"), { ma: p.bookingId })];
    case "MOVE_BOOKING":
      return [
        fill(t("Đặt phòng: {ma}"), { ma: p.bookingId }),
        fill(t("Chuyển sang: {ten}"), { ten: room(p.roomId) }),
        fill(t("Ngày mới: {tu} → {den}"), { tu: p.checkIn, den: p.checkOut }),
      ];
    case "SET_PRICE":
      return [
        fill(t("Phòng: {ten}"), { ten: room(p.roomId) }),
        fill(t("Giá mỗi đêm: {gia}"), {
          gia: p.basePrice === null ? t("bỏ giá") : formatMoney(p.basePrice, currency, locale),
        }),
      ];
    case "NONE":
      return [p.why];
  }
}

export default async function AssistantPage() {
  const t = await getT();
  const locale = await readLocale();
  const member = await requireMember();
  const currency = await orgCurrency();
  if (!canManageBookings(member)) redirect("/buong-phong");

  const { proposals, rooms } = await withOrg(member.orgId, async (tx) => {
    const proposals = await tx.aiProposal.findMany({
      select: {
        id: true,
        prompt: true,
        summary: true,
        kind: true,
        payload: true,
        status: true,
        expiresAt: true,
        error: true,
        createdAt: true,
        approvedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const rooms = await tx.room.findMany({
      select: { id: true, name: true, property: { select: { name: true } } },
    });

    return { proposals, rooms };
  });

  const roomNames = new Map(
    rooms.map((r) => [r.id, `${r.property.name} — ${r.name}`]),
  );

  const now = new Date();

  return (
    <>
      <h1 className="text-[18px] font-semibold text-ink-900">
        {t("Trợ lý")}
      </h1>
      <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
        {t("Mọi đề xuất trợ lý đã soạn, kèm việc bạn đã duyệt hay bỏ qua. Hỏi trợ lý ở khung bên phải màn hình.")}
      </p>

      {proposals.length > 0 ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.25rem] font-semibold text-ink-900">{t("Đề xuất")}</h2>

          <ul className="mt-5 space-y-4">
            {proposals.map((p) => {
              const expired =
                p.status === "EXPIRED" ||
                (p.status === "PENDING" && p.expiresAt <= now);
              const pending = p.status === "PENDING" && !expired;

              return (
                <li
                  key={p.id}
                  className={`rounded-2xl border bg-surface p-6 ${
                    pending ? "border-clay-200" : "border-line"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                        {t(KIND_LABELS[p.kind as keyof typeof KIND_LABELS] ?? p.kind)}
                      </p>
                      <p className="mt-1 text-[16px] font-semibold leading-snug text-ink-900">
                        {p.summary}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        p.status === "APPROVED"
                          ? "bg-positive-soft text-positive"
                          : p.status === "REJECTED"
                            ? "bg-sand-200 text-ink-600"
                            : expired
                              ? "bg-sand-200 text-ink-500"
                              : "bg-warning-soft text-warning"
                      }`}
                    >
                      {p.status === "APPROVED"
                        ? t("Đã duyệt")
                        : p.status === "REJECTED"
                          ? t("Đã từ chối")
                          : expired
                            ? t("Hết hạn")
                            : t("Chờ bạn duyệt")}
                    </span>
                  </div>

                  <p className="mt-3 border-l-2 border-line pl-3 text-[13.5px] italic leading-relaxed text-ink-500">
                    “{p.prompt}”
                  </p>

                  {/* The change itself, read back out of the stored payload
                      rather than from the summary above it. */}
                  <dl className="mt-4 space-y-1 rounded-xl bg-sand-50 px-4 py-3">
                    {preview(p.payload, roomNames, t, locale, currency).map((line) => (
                      <dd key={line} className="text-[13.5px] text-ink-700">
                        {line}
                      </dd>
                    ))}
                  </dl>

                  {p.error ? (
                    <p
                      role="alert"
                      className="mt-3 rounded-xl border border-danger/25 bg-danger-soft px-4 py-2.5 text-[13.5px] leading-relaxed text-danger"
                    >
                      {p.error}
                    </p>
                  ) : null}

                  {pending && p.kind !== "NONE" ? (
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <form action={approve}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-[15px] font-semibold text-sand-100 hover:bg-ink-800"
                        >
                          {t("Duyệt")}
                        </button>
                      </form>
                      <form action={reject}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="flex min-h-11 items-center rounded-full border border-line px-5 text-[14px] font-medium text-ink-600 hover:bg-sand-50"
                        >
                          {t("Từ chối")}
                        </button>
                      </form>
                      <span className="text-[12.5px] text-ink-400">
                        {t("Hết hạn lúc")}{" "}
                        {p.expiresAt.toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-4 text-[12.5px] text-ink-400">
                      {shortVi(p.createdAt)}
                      {p.approvedAt
                        ? fill(t(" · duyệt {ngay}"), {
                            ngay: shortVi(p.approvedAt),
                          })
                        : ""}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        // Without this the page is a heading and a sentence. The ask form used
        // to fill the space, and taking it away left a screen that looks
        // broken rather than empty.
        <p className="mt-10 max-w-2xl rounded-2xl border border-line bg-surface px-5 py-4 text-[14px] leading-relaxed text-ink-600">
          {t("Chưa có đề xuất nào. Mở trợ lý ở khung bên phải và mô tả việc bạn cần — mọi thứ nó soạn sẽ hiện ở đây.")}
        </p>
      )}
    </>
  );
}
