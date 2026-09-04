import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CopyLine } from "@/components/CopyLine";
import { requireMember } from "@/lib/dal";
import { formatPlanPrice } from "@/lib/dates";
import { withOrg } from "@/lib/db";
import { fill } from "@/lib/i18n";
import { getT, readLocale } from "@/lib/locale";
import { PLANS } from "@/lib/plans";
import { bankAccount, qrPayloadFor } from "@/lib/purchases";
import { qrMatrix, qrPath } from "@/lib/qr";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Thanh toán") };
}

/**
 * What to transfer, and where.
 *
 * Everything a host needs is on one screen and every field is copyable,
 * because the alternative is retyping an account number off a laptop into a
 * phone. The reference is the only part that must be exact — it is how a
 * transfer is matched to this purchase — so it is the largest thing here after
 * the amount.
 *
 * The page does not poll. Nothing here can tell whether the money arrived, and
 * a spinner that means "we have no idea" is worse than a sentence that says
 * so.
 */
export default async function PurchasePage(props: PageProps<"/cai-dat/mua/[id]">) {
  const t = await getT();
  const locale = await readLocale();
  const member = await requireMember();
  if (member.role !== "OWNER") redirect("/cai-dat?muc=goi");

  const { id } = await props.params;

  const purchase = await withOrg(member.orgId, (tx) =>
    tx.planPurchase.findUnique({
      where: { id },
      select: {
        id: true,
        plan: true,
        amount: true,
        reference: true,
        status: true,
        periodEnd: true,
        createdAt: true,
      },
    }),
  );
  if (!purchase) notFound();

  const account = bankAccount();
  const payload = qrPayloadFor(purchase);

  return (
    <>
      <Link
        href="/cai-dat?muc=goi"
        className="text-[14px] font-medium text-ink-500 hover:text-ink-900"
      >
        {t("← Về gói dịch vụ")}
      </Link>

      <h1 className="mt-3 text-[18px] font-semibold text-ink-900">
        {fill(t("Mua 1 tháng gói {ten}"), { ten: t(PLANS[purchase.plan].name) })}
      </h1>

      {purchase.status === "PAID" ? (
        <p className="mt-4 max-w-2xl rounded-xl border border-positive/30 bg-positive-soft px-4 py-3 text-[14px] leading-relaxed text-positive">
          {purchase.periodEnd
            ? fill(t("Đã nhận thanh toán. Gói chạy tới {ngay}."), {
                ngay: purchase.periodEnd.toLocaleDateString(
                  locale === "en" ? "en-GB" : "vi-VN",
                ),
              })
            : t("Đã nhận thanh toán.")}
        </p>
      ) : purchase.status === "CANCELLED" ? (
        <p className="mt-4 max-w-2xl rounded-xl border border-line px-4 py-3 text-[14px] text-ink-600">
          {t("Đơn này đã hủy. Tạo đơn mới nếu bạn vẫn muốn mua.")}
        </p>
      ) : account === null || payload === null ? (
        <p
          role="alert"
          className="mt-4 max-w-2xl rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-[14px] leading-relaxed text-warning"
        >
          {t("Chưa cấu hình tài khoản nhận tiền, nên chưa hiện được mã QR. Đơn đã ghi nhận — liên hệ chúng tôi để thanh toán.")}
        </p>
      ) : (
        <>
          <p className="mb-6 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            {t("Quét mã bằng app ngân hàng, hoặc chuyển khoản thủ công theo thông tin bên dưới. Nội dung chuyển khoản phải đúng — đó là thứ khớp giao dịch của bạn với đơn này.")}
          </p>

          <div className="grid max-w-3xl gap-8 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div>
              {/* Drawn here, not fetched. A QR from someone else's server is
                  every account number and amount our hosts transfer, handed to
                  a third party. */}
              <QrCode payload={payload} />
              <p className="mt-2 text-center text-[12px] text-ink-500">
                {t("VietQR · quét bằng app ngân hàng")}
              </p>
            </div>

            <dl className="space-y-3">
              <CopyLine label={t("Ngân hàng")} value={account.bankName} />
              <CopyLine label={t("Số tài khoản")} value={account.accountNumber} mono />
              <CopyLine label={t("Chủ tài khoản")} value={account.accountName} />
              <CopyLine
                label={t("Số tiền")}
                value={String(purchase.amount)}
                display={formatPlanPrice(purchase.amount, locale)}
                mono
              />
              <CopyLine
                label={t("Nội dung chuyển khoản")}
                value={purchase.reference}
                mono
                emphasis
              />
            </dl>
          </div>

          <p className="mt-8 max-w-2xl border-t border-line pt-5 text-[13px] leading-relaxed text-ink-500">
            {t("Chuyển xong, gói được mở sau khi chúng tôi đối chiếu sao kê — thường trong vài giờ làm việc. Trang này không tự cập nhật; bạn sẽ thấy gói mới ở màn hình Gói dịch vụ.")}
          </p>
        </>
      )}
    </>
  );
}

/**
 * The symbol, as one SVG path.
 *
 * shape-rendering="crispEdges" matters more than it looks: without it the
 * browser antialiases every module edge, and a scanner reading a small QR off
 * a screen sees grey where it needs a decision.
 */
function QrCode({ payload }: { payload: string }) {
  const matrix = qrMatrix(payload);
  const size = matrix.length;
  // Four modules of quiet zone, which is what the spec requires for a decoder
  // to find the symbol's edge at all.
  const quiet = 4;
  const total = size + quiet * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="VietQR"
      className="w-full max-w-[220px] rounded-xl border border-line bg-white p-2"
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#ffffff" />
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={qrPath(matrix)} fill="#000000" />
      </g>
    </svg>
  );
}
