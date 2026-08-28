import type { Metadata } from "next";
import Link from "next/link";

import { readAppearance } from "@/lib/appearance";
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

export const metadata: Metadata = { title: "Cài đặt" };

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Chủ nhà",
  COLLABORATOR: "Cộng tác viên",
  HOUSEKEEPER: "Dọn phòng",
};

export default async function SettingsPage() {
  const member = await requireMember();
  const isOwner = member.role === "OWNER";
  const appearance = await readAppearance();

  const org = await withOrg(member.orgId, (tx) =>
    tx.organization.findUnique({
      where: { id: member.orgId },
      select: {
        name: true,
        timezone: true,
        currency: true,
        bookingTheme: true,
        brandColor: true,
        logoFile: true,
      },
    }),
  );

  return (
    <>
      <h1 className="text-[1.75rem] font-semibold leading-tight text-ink-900">
        Cài đặt
      </h1>
      <p className="mt-1 text-[14px] text-ink-600">
        {member.email} · {ROLE_LABELS[member.role] ?? member.role}
      </p>

      {/* ---- personal ---------------------------------------------------- */}
      <section className="mt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">Tài khoản</h2>
        <div className="mt-5">
          <ProfileForm action={updateProfile} name={member.userName} />
        </div>
      </section>

      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">Mật khẩu</h2>
        <div className="mt-5">
          <PasswordForm action={changePassword} />
        </div>
      </section>

      {/* ---- the business ------------------------------------------------ */}
      {isOwner ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">Cơ sở</h2>
          <div className="mt-5">
            <OrgForm
              action={updateOrg}
              name={org?.name ?? ""}
              timezone={org?.timezone ?? "Asia/Ho_Chi_Minh"}
            />
          </div>

          <p className="mt-6 max-w-xl text-[13px] leading-relaxed text-ink-500">
            Đơn vị tiền tệ đang là{" "}
            <span className="font-medium text-ink-700">{org?.currency}</span>.
            Đổi tiền tệ chưa làm được từ đây: mọi giá đã nhập đều là số nguyên
            theo đơn vị hiện tại, nên đổi mà không quy đổi lại sẽ biến 1.200.000
            đồng thành 1.200.000 đô. Khi nào cần, việc đó phải kèm một bước quy
            đổi thật.
          </p>
        </section>
      ) : (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">Cơ sở</h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-ink-600">
            Bạn đang ở trong <span className="font-medium">{org?.name}</span>.
            Chỉ chủ nhà đổi được tên và múi giờ.
          </p>
        </section>
      )}

      {/* ---- this device ---------------------------------------------------- */}
      <section className="mt-12 border-t border-line pt-10">
        <h2 className="text-[1.125rem] font-semibold text-ink-900">Giao diện</h2>
        <p className="mb-4 mt-1 max-w-xl text-[14px] leading-relaxed text-ink-600">
          Sáng, tối, hoặc theo cài đặt của máy. Lưu riêng cho thiết bị này —
          người khác trong đội không bị đổi theo.
        </p>

        <div className="flex flex-wrap gap-2">
          {[
            { value: "light", label: "Sáng" },
            { value: "dark", label: "Tối" },
            { value: "system", label: "Theo hệ thống" },
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
      </section>

      {/* ---- how the guest page looks -------------------------------------- */}
      {isOwner ? (
        <section className="mt-12 border-t border-line pt-10">
          <h2 className="text-[1.125rem] font-semibold text-ink-900">
            Giao diện trang đặt phòng
          </h2>
          <p className="mb-6 mt-1 max-w-2xl text-[14px] leading-relaxed text-ink-600">
            Trang khách nhìn thấy khi bạn chia sẻ link. Áp dụng cho tất cả chỗ
            nghỉ.
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
        <h2 className="text-[1.125rem] font-semibold text-ink-900">Nơi khác</h2>
        <ul className="mt-4 space-y-2 text-[14px]">
          {isOwner ? (
            <li>
              <Link
                href="/doi-ngu"
                className="font-medium text-ink-900 underline underline-offset-4"
              >
                Đội ngũ & phân quyền
              </Link>
              <span className="text-ink-500"> — mời người, giao chỗ nghỉ, gỡ quyền</span>
            </li>
          ) : null}
          <li>
            <Link
              href="/kenh"
              className="font-medium text-ink-900 underline underline-offset-4"
            >
              Kênh bán
            </Link>
            <span className="text-ink-500"> — đồng bộ iCal và link xuất lịch</span>
          </li>
          <li>
            <Link
              href="/cho-nghi"
              className="font-medium text-ink-900 underline underline-offset-4"
            >
              Chỗ nghỉ
            </Link>
            <span className="text-ink-500"> — giá phòng và trang đặt phòng của khách</span>
          </li>
        </ul>
      </section>
    </>
  );
}
