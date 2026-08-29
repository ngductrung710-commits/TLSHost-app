import type { Metadata } from "next";
import Link from "next/link";

import { readAppearance } from "@/lib/appearance";
import { PLANS, PLAN_ORDER, effectivePlan } from "@/lib/plans";
import { pushConfigured } from "@/lib/push";
import { secretsConfigured } from "@/lib/secrets";
import { formatVnd } from "@/lib/dates";
import { requireMember } from "@/lib/dal";
import { withOrg } from "@/lib/db";

import type { BookingTheme } from "@/lib/themes";

import { AppearanceForm, LogoForm } from "./AppearanceForm";
import { OrgForm, PasswordForm, ProfileForm } from "./SettingsForms";
import {
  changePassword,
  removeLogo,
  updateAppearance,
  updateOrg,
  updateProfile,
  uploadLogo,
} from "./actions";
import { setAppearance } from "./appearanceAction";
import { setLocale } from "./localeAction";
import { PushControls } from "./PushControls";
import { sendTestPush, subscribePush, unsubscribePush } from "./pushActions";
import { PaymentForm } from "./PaymentForm";
import { connectPayments, disconnectPayments } from "./paymentActions";
import { getT, readLocale } from "@/lib/locale";
import { LOCALE_NAMES, fill } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Cài đặt") };
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Chủ nhà",
  COLLABORATOR: "Cộng tác viên",
  HOUSEKEEPER: "Dọn phòng",
};

export default async function SettingsPage() {
  const t = await getT();
  const locale = await readLocale();
  const member = await requireMember();
  const isOwner = member.role === "OWNER";
  const appearance = await readAppearance();

  // Endpoints this org already has, so the control can tell "this device is
  // registered" from "this browser has a subscription the server forgot".
  const pushEndpoints = pushConfigured()
    ? (
        await withOrg(member.orgId, (tx) =>
          tx.pushSubscription.findMany({
            where: { userId: member.userId },
            select: { endpoint: true },
          }),
        )
      ).map((s) => s.endpoint)
    : [];

  const org = await withOrg(member.orgId, (tx) =>
    tx.organization.findUnique({
      where: { id: member.orgId },
      select: {
        name: true,
        timezone: true,
        currency: true,
        plan: true,
        planUntil: true,
        bookingTheme: true,
        brandColor: true,
        logoFile: true,
      },
    }),
  );

  const paymentAccounts = isOwner
    ? await withOrg(member.orgId, (tx) =>
        tx.paymentAccount.findMany({
          select: { provider: true, publicId: true, live: true, verifiedAt: true },
        }),
      )
    : [];
  const accountFor = (p: "STRIPE" | "PAYPAL") =>
    paymentAccounts.find((a) => a.provider === p) ?? null;

  // What they bought, and what is actually in force — different when a
  // subscription has lapsed.
  const active = org ? effectivePlan(org.plan, org.planUntil) : "FREE";
  const lapsed = Boolean(org && org.plan !== "FREE" && active === "FREE");

  return (
    <>
      <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
        {t("Cài đặt")}
      </h1>
      <p className="mt-1 text-[14px] text-ink-600">
        {member.email} · {t(ROLE_LABELS[member.role] ?? member.role)}
      </p>

      {/* ---- personal ---------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">{t("Tài khoản")}</h2>
        <div className="mt-5">
          <ProfileForm action={updateProfile} name={member.userName} />
        </div>
      </section>

      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">{t("Mật khẩu")}</h2>
        <div className="mt-5">
          <PasswordForm action={changePassword} />
        </div>
      </section>

      {/* ---- the business ------------------------------------------------ */}
      {isOwner ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">{t("Cơ sở")}</h2>
          <div className="mt-5">
            <OrgForm
              action={updateOrg}
              name={org?.name ?? ""}
              timezone={org?.timezone ?? "Asia/Ho_Chi_Minh"}
            />
          </div>

          <p className="mt-6 max-w-xl text-[13px] leading-relaxed text-ink-500">
            {t("Đơn vị tiền tệ đang là")}{" "}
            <span className="font-medium text-ink-700">{org?.currency}</span>{t(". Đổi tiền tệ chưa làm được từ đây: mọi giá đã nhập đều là số nguyên theo đơn vị hiện tại, nên đổi mà không quy đổi lại sẽ biến 1.200.000 đồng thành 1.200.000 đô. Khi nào cần, việc đó phải kèm một bước quy đổi thật.")}
          </p>
        </section>
      ) : (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">{t("Cơ sở")}</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-600">
            {t("Bạn đang ở trong")} <span className="font-medium">{org?.name}</span>{t(". Chỉ chủ nhà đổi được tên và múi giờ.")}
          </p>
        </section>
      )}

      {/* ---- this device ---------------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">{t("Giao diện")}</h2>
        <p className="mb-4 mt-1 max-w-xl text-[14px] leading-relaxed text-ink-600">
          {t("Sáng, tối, hoặc theo cài đặt của máy. Lưu riêng cho thiết bị này — người khác trong đội không bị đổi theo.")}
        </p>

        <div className="flex flex-wrap gap-2">
          {[
            { value: "light", label: t("Sáng") },
            { value: "dark", label: t("Tối") },
            { value: "system", label: t("Theo hệ thống") },
          ].map((option) => (
            <form key={option.value} action={setAppearance}>
              <input type="hidden" name="appearance" value={option.value} />
              <button
                type="submit"
                aria-pressed={appearance === option.value}
                className={`flex min-h-11 items-center rounded-full border px-5 text-[14px] font-medium transition-colors ${
                  appearance === option.value
                    ? "border-ink-900 bg-ink-900 text-sand-100"
                    : "border-line bg-surface text-ink-700 hover:bg-sand-50"
                }`}
              >
                {option.label}
              </button>
            </form>
          ))}
        </div>

        <h2 className="mt-10 text-[1.125rem] font-semibold text-ink-900">
          {t("Ngôn ngữ")}
        </h2>
        <p className="mb-4 mt-1 max-w-xl text-[14px] leading-relaxed text-ink-600">
          {t("Ngôn ngữ của không gian làm việc, riêng cho thiết bị này. Trang đặt phòng khách nhìn thấy không đổi theo — đó là lựa chọn của chỗ nghỉ, không phải của người đang đăng nhập.")}
        </p>

        <div className="flex flex-wrap gap-2">
          {(["vi", "en"] as const).map((value) => (
            <form key={value} action={setLocale}>
              <input type="hidden" name="locale" value={value} />
              <button
                type="submit"
                lang={value}
                aria-pressed={locale === value}
                className={`flex min-h-11 items-center rounded-full border px-5 text-[14px] font-medium transition-colors ${
                  locale === value
                    ? "border-ink-900 bg-ink-900 text-sand-100"
                    : "border-line bg-surface text-ink-700 hover:bg-sand-50"
                }`}
              >
                {/* Never translated: someone who cannot read the current
                    language has to be able to find their own in this list. */}
                {LOCALE_NAMES[value]}
              </button>
            </form>
          ))}
        </div>
      </section>

      {/* ---- payments -------------------------------------------------------- */}
      {isOwner ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            {t("Thanh toán")}
          </h2>
          <p className="mb-5 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            {t("Kết nối tài khoản Stripe hoặc PayPal")} <span className="font-medium">{t("của chính bạn")}</span>{t(". Khách trả thẳng vào đó — TLSHost không giữ tiền và không lấy phần trăm nào. Phí của cổng thanh toán là do họ thu, không phải chúng tôi.")}
          </p>

          {!secretsConfigured() ? (
            <p className="max-w-2xl rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-[13.5px] leading-relaxed text-warning">
              {t("Máy chủ chưa đặt SECRET_KEY nên chưa lưu được khoá thanh toán một cách an toàn. Xem README để tạo.")}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {(["STRIPE", "PAYPAL"] as const).map((p) => {
                const account = accountFor(p);
                return (
                  <div key={p} className="space-y-2">
                    <PaymentForm
                      action={connectPayments}
                      provider={p}
                      connected={Boolean(account?.verifiedAt)}
                      live={account?.live ?? false}
                      publicId={account?.publicId ?? null}
                    />
                    {account ? (
                      <form action={disconnectPayments}>
                        <input type="hidden" name="provider" value={p} />
                        <button
                          type="submit"
                          className="min-h-11 px-3 text-[13px] font-medium text-danger hover:underline"
                        >
                          {fill(t("Ngắt kết nối {ten}"), {
                            ten: p === "STRIPE" ? "Stripe" : "PayPal",
                          })}
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-ink-500">
            {t("Chưa kết nối cổng nào thì khách vẫn đặt phòng bình thường và trả khi nhận phòng — đó cũng là cách phần lớn chỗ nghỉ ở Việt Nam đang làm.")}
          </p>
        </section>
      ) : null}

      {/* ---- plan ----------------------------------------------------------- */}
      {isOwner ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            {t("Gói dịch vụ")}
          </h2>
          <p className="mb-5 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            {t("Thuê bao cố định, không phí trên mỗi lượt đặt ở bất kỳ gói nào.")}
          </p>

          {lapsed ? (
            <p
              role="alert"
              className="mb-5 max-w-2xl rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-[13.5px] leading-relaxed text-warning"
            >
              {fill(
                t(
                  t("Gói {ten} đã hết hạn. Giới hạn tạm quay về gói Khởi đầu — không có gì bị xoá, chỗ nghỉ và đặt phòng vẫn nguyên, chỉ là chưa thêm mới được cho tới khi gia hạn."),
                ),
                { ten: t(PLANS[org!.plan].name) },
              )}
            </p>
          ) : null}

          <ul className="grid gap-4 sm:grid-cols-3">
            {PLAN_ORDER.map((p) => {
              const plan = PLANS[p];
              const current = p === active;
              return (
                <li
                  key={p}
                  className={`rounded-2xl border p-5 ${
                    current ? "border-ink-900 bg-sand-50" : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold text-ink-900">
                      {t(plan.name)}
                    </p>
                    {current ? (
                      <span className="rounded-full bg-ink-900 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sand-100">
                        {t("Đang dùng")}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-[1.375rem] font-semibold text-ink-900 tnum">
                    {plan.price === 0 ? t("Miễn phí") : formatVnd(plan.price, locale)}
                    {plan.price > 0 ? (
                      <span className="text-[13px] font-normal text-ink-500">
                        {" "}
                        {t("/ tháng")}
                      </span>
                    ) : null}
                  </p>

                  <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-[13px] text-ink-700">
                    <li>
                      {plan.maxProperties === null
                        ? t("Không giới hạn chỗ nghỉ")
                        : fill(t("{n} chỗ nghỉ"), { n: plan.maxProperties })}
                    </li>
                    <li className={plan.channels ? "" : "text-ink-400"}>
                      {plan.channels ? t("Đồng bộ kênh OTA") : t("Chưa có đồng bộ kênh")}
                    </li>
                    <li className={plan.assistant ? "" : "text-ink-400"}>
                      {plan.assistant ? t("Trợ lý AI") : t("Chưa có trợ lý AI")}
                    </li>
                    <li className={plan.team ? "" : "text-ink-400"}>
                      {plan.team ? t("Đội ngũ & phân quyền") : t("Chưa có đội ngũ")}
                    </li>
                  </ul>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-ink-500">
            {t("Đang dùng:")} <span className="font-medium text-ink-700">{t(PLANS[active].name)}</span>
            {org?.planUntil
              ? fill(t(" · đến {ngay}"), {
                  // The date reads in the language the rest of the sentence is
                  // in. 28/8/2026 either way, but the month name in a long
                  // format would not be.
                  ngay: org.planUntil.toLocaleDateString(
                    locale === "en" ? "en-GB" : "vi-VN",
                  ),
                })
              : ""}
            {t(". Chưa có thanh toán trong ứng dụng — nhắn cho chúng tôi để đổi gói.")}
          </p>
        </section>
      ) : null}

      {/* ---- notifications -------------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">
          {t("Thông báo đặt phòng")}
        </h2>
        <p className="mb-4 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
          {t("Báo trên thiết bị này khi có khách đặt trực tiếp. Thông báo chỉ nói tên khách và phòng — không có số điện thoại, không có số tiền, vì nó hiện trên màn hình khoá nơi người bên cạnh cũng đọc được.")}
        </p>

        {process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? (
          <PushControls
            publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY}
            subscribeAction={subscribePush}
            unsubscribeAction={unsubscribePush}
            testAction={sendTestPush}
            knownEndpoints={pushEndpoints}
          />
        ) : (
          <p className="max-w-xl rounded-xl border border-line bg-sand-50 px-4 py-3 text-[13.5px] leading-relaxed text-ink-600">
            {t("Chưa cấu hình khoá VAPID trên máy chủ, nên thông báo chưa dùng được. Xem README để tạo và thêm vào .env.")}
          </p>
        )}
      </section>

      {/* ---- how the guest page looks -------------------------------------- */}
      {isOwner ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            {t("Giao diện trang đặt phòng")}
          </h2>
          <p className="mb-6 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            {t("Trang khách nhìn thấy khi bạn chia sẻ link. Áp dụng cho tất cả chỗ nghỉ.")}
          </p>

          <LogoForm
            action={uploadLogo}
            removeAction={removeLogo}
            logoFile={org?.logoFile ?? null}
            orgName={org?.name ?? ""}
          />

          <div className="mt-8">
            <AppearanceForm
              action={updateAppearance}
              bookingTheme={(org?.bookingTheme ?? "CLASSIC") as BookingTheme}
              brandColor={org?.brandColor ?? null}
            />
          </div>
        </section>
      ) : null}

      {/* ---- pointers ----------------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">{t("Nơi khác")}</h2>
        <ul className="mt-4 space-y-2 text-[14px]">
          {isOwner ? (
            <li>
              <Link
                href="/doi-ngu"
                className="font-medium text-ink-900 underline underline-offset-4"
              >
                {t("Đội ngũ & phân quyền")}
              </Link>
              <span className="text-ink-500"> {t("— mời người, giao chỗ nghỉ, gỡ quyền")}</span>
            </li>
          ) : null}
          <li>
            <Link
              href="/kenh"
              className="font-medium text-ink-900 underline underline-offset-4"
            >
              {t("Kênh bán")}
            </Link>
            <span className="text-ink-500"> {t("— đồng bộ iCal và link xuất lịch")}</span>
          </li>
          <li>
            <Link
              href="/cho-nghi"
              className="font-medium text-ink-900 underline underline-offset-4"
            >
              {t("Chỗ nghỉ")}
            </Link>
            <span className="text-ink-500"> {t("— giá phòng và trang đặt phòng của khách")}</span>
          </li>
        </ul>
      </section>
    </>
  );
}
