import type { Metadata } from "next";

import { requireMember } from "@/lib/dal";
import { contextLabel, loadHousekeeping } from "@/lib/housekeeping";
import { shortVi, todayIn } from "@/lib/dates";

import { markAllClean, markRoom } from "./actions";
import { getT } from "@/lib/locale";
import { fill } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Buồng phòng") };
}

const STATE_STYLES: Record<string, string> = {
  CLEAN: "bg-positive-soft text-positive",
  DIRTY: "bg-warning-soft text-warning",
  INSPECTED: "bg-ink-900 text-sand-100",
  MAINTENANCE: "bg-danger-soft text-danger",
};

const STATE_LABELS: Record<string, string> = {
  CLEAN: "Sạch",
  DIRTY: "Bẩn",
  INSPECTED: "Đã kiểm tra",
  MAINTENANCE: "Bảo trì",
};

export default async function HousekeepingPage() {
  const t = await getT();
  const member = await requireMember();
  const today = todayIn(member.timezone);
  const jobs = await loadHousekeeping(member, today);

  const housekeeper = member.role === "HOUSEKEEPER";
  const needing = jobs.filter((j) => j.needsCleaning);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-semibold text-ink-900">
            {t("Buồng phòng")}
          </h1>
          <p className="mt-1 text-[14px] text-ink-600">
            {shortVi(today)} ·{" "}
            {needing.length === 0 ? (
              t("không còn phòng nào cần dọn")
            ) : (
              <span className="font-medium text-ink-900">
                <span className="tnum">{needing.length}</span> {t("phòng cần dọn")}
              </span>
            )}
          </p>
        </div>

        {needing.length > 0 ? (
          <form action={markAllClean}>
            <button
              type="submit"
              className="flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-[14px] font-medium text-ink-700 hover:bg-sand-50"
            >
              {t("Đánh dấu tất cả đã sạch")}
            </button>
          </form>
        ) : null}
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          title={t("Chưa có phòng nào")}
          description={t("Bảng này dựng từ danh sách phòng. Thêm chỗ nghỉ rồi quay lại.")}
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {jobs.map((job) => (
            <li
              key={job.roomId}
              className={`rounded-2xl border bg-surface px-5 py-4 ${
                job.needsCleaning ? "border-warning/40" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold text-ink-900">
                    {job.roomName}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink-500">
                    {job.propertyName} · {t(contextLabel(job.context))}
                    {/* Housekeepers are deliberately not told who is coming.
                        The spec is explicit that they see rooms, not guests. */}
                    {!housekeeper && job.arrivingGuest
                      ? fill(t(" · đón {ten}"), { ten: job.arrivingGuest })
                      : ""}
                  </p>
                </div>

                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    job.needsCleaning
                      ? STATE_STYLES.DIRTY
                      : STATE_STYLES[job.state]
                  }`}
                >
                  {job.needsCleaning ? t("Cần dọn") : t(STATE_LABELS[job.state])}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {job.state !== "MAINTENANCE" ? (
                  <form action={markRoom}>
                    <input type="hidden" name="roomId" value={job.roomId} />
                    <input type="hidden" name="state" value="CLEAN" />
                    <button
                      type="submit"
                      className="flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 hover:bg-ink-800"
                    >
                      {t("Đánh dấu sạch")}
                    </button>
                  </form>
                ) : null}

                {!housekeeper ? (
                  <>
                    {job.state !== "MAINTENANCE" ? (
                      <form action={markRoom}>
                        <input type="hidden" name="roomId" value={job.roomId} />
                        <input type="hidden" name="state" value="INSPECTED" />
                        <button
                          type="submit"
                          className="flex min-h-11 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-50"
                        >
                          {t("Đã kiểm tra")}
                        </button>
                      </form>
                    ) : null}

                    <form action={markRoom}>
                      <input type="hidden" name="roomId" value={job.roomId} />
                      <input
                        type="hidden"
                        name="state"
                        value={job.state === "MAINTENANCE" ? "DIRTY" : "MAINTENANCE"}
                      />
                      <button
                        type="submit"
                        className="flex min-h-11 items-center rounded-full px-3 text-[13px] font-medium text-danger hover:bg-danger-soft"
                      >
                        {job.state === "MAINTENANCE"
                          ? t("Bỏ đánh dấu bảo trì")
                          : t("Gắn cờ bảo trì")}
                      </button>
                    </form>
                  </>
                ) : null}

                {job.cleanedAt && !job.needsCleaning ? (
                  <span className="ml-auto text-[12px] text-ink-400">
                    {fill(t("Dọn {ngay}"), { ngay: shortVi(job.cleanedAt) })}
                    {job.cleanedBy ? ` · ${job.cleanedBy}` : ""}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 max-w-2xl text-[13px] leading-relaxed text-ink-500">
        {t("Phòng tự chuyển sang cần dọn khi có khách trả phòng — không phải chờ ai bấm gì. Trạng thái đọc lại từ lịch mỗi lần mở trang, nên không bao giờ lệch.")}
      </p>
    </>
  );
}
