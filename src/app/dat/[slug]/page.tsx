import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { amenityNames } from "@/lib/amenities";
import { withOrg, withPublicSlug } from "@/lib/db";
import {
  addDays,
  daysBetween,
  formatMoney,
  parseIsoDate,
  shortDate,
  todayIn,
  toIsoDate,
} from "@/lib/dates";
import { guestLocale, guestT, withLocale } from "@/lib/guestLocale";
import { fill } from "@/lib/i18n";
import { dictFor } from "@/lib/locale";
import { I18nProvider } from "@/components/I18nProvider";

import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { THEMES, themeVars, type BookingTheme } from "@/lib/themes";

import { BookingWidget } from "./BookingWidget";
import { requestBooking } from "./actions";

/**
 * The guest-facing booking page.
 *
 * Public, outside every session, and the only page in the app a stranger is
 * meant to reach. Two consequences run through it: nothing here may show what
 * a guest should not see — no other guests' names, no channel details, no
 * internal notes — and every date it accepts goes through exactly the same
 * availability check the host's own calendar does.
 */

type Loaded = {
  orgId: string;
  name: string;
  address: string | null;
  type: string | null;
  intro: string | null;
  houseRules: string | null;
  amenities: string[];
  currency: string;
  timezone: string;
  theme: BookingTheme;
  brandColor: string | null;
  logoFile: string | null;
  orgName: string;
  rooms: {
    id: string;
    name: string;
    capacity: number;
    basePrice: number | null;
    description: string | null;
    amenities: string[];
  }[];
};

async function load(slug: string): Promise<Loaded | null> {
  // Two steps, as with the feed. The slug buys the property and its rooms;
  // everything after that goes through the ordinary org scope.
  const found = await withPublicSlug(slug, async (tx) => {
    const property = await tx.property.findFirst({
      where: { publicSlug: slug, published: true },
      select: {
        id: true,
        orgId: true,
        name: true,
        type: true,
        address: true,
        intro: true,
        houseRules: true,
        amenities: true,
      },
    });
    if (!property) return null;

    const rooms = await tx.room.findMany({
      where: { propertyId: property.id },
      select: {
        id: true,
        name: true,
        capacity: true,
        basePrice: true,
        description: true,
        amenities: true,
      },
      orderBy: { name: "asc" },
    });

    return { property, rooms };
  });

  if (!found) return null;

  const org = await withOrg(found.property.orgId, (tx) =>
    tx.organization.findUnique({
      where: { id: found.property.orgId },
      select: {
        name: true,
        currency: true,
        timezone: true,
        bookingTheme: true,
        brandColor: true,
        logoFile: true,
      },
    }),
  );

  return {
    orgId: found.property.orgId,
    name: found.property.name,
    address: found.property.address,
    type: found.property.type,
    intro: found.property.intro,
    houseRules: found.property.houseRules,
    amenities: found.property.amenities,
    currency: org?.currency ?? "VND",
    timezone: org?.timezone ?? "Asia/Ho_Chi_Minh",
    theme: (org?.bookingTheme ?? "CLASSIC") as BookingTheme,
    brandColor: org?.brandColor ?? null,
    logoFile: org?.logoFile ?? null,
    orgName: org?.name ?? "",
    rooms: found.rooms,
  };
}

export async function generateMetadata(
  props: PageProps<"/dat/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const t = guestT(await guestLocale(await props.searchParams));
  const property = await load(slug);
  if (!property) return { title: t("Không tìm thấy") };

  return {
    title: property.name,
    description:
      property.intro ??
      fill(t("Đặt phòng trực tiếp tại {ten}{diachi}."), {
        ten: property.name,
        diachi: property.address ? `, ${property.address}` : "",
      }),
    // This one page is meant to be found — it is the host's storefront, and the
    // rest of the app is explicitly not indexed.
    robots: { index: true, follow: true },
  };
}

export default async function PublicBookingPage(
  props: PageProps<"/dat/[slug]">,
) {
  const { slug } = await props.params;
  const params = await props.searchParams;
  const locale = await guestLocale(params);
  const t = guestT(locale);

  const property = await load(slug);
  if (!property) notFound();

  const today = todayIn(property.timezone);
  const from = (typeof params.tu === "string" ? parseIsoDate(params.tu) : null) ?? today;
  const to =
    (typeof params.den === "string" ? parseIsoDate(params.den) : null) ??
    addDays(from, 2);

  const nights = Math.max(1, daysBetween(from, to));

  // Which rooms are actually free for the dates on screen. Computed here rather
  // than left to the form, so a guest never picks a room they cannot have and
  // learns it only after typing their details.
  const free = await withOrg(property.orgId, async (tx) => {
    const roomIds = property.rooms.map((r) => r.id);
    if (roomIds.length === 0) return new Set<string>();

    const bookings = await tx.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { not: "CANCELLED" },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
      select: { roomId: true },
    });
    const blocks = await tx.block.findMany({
      where: { roomId: { in: roomIds }, dateFrom: { lt: to }, dateTo: { gt: from } },
      select: { roomId: true },
    });

    const taken = new Set([
      ...bookings.map((b) => b.roomId),
      ...blocks.map((b) => b.roomId),
    ]);
    return new Set(roomIds.filter((id) => !taken.has(id)));
  });

  const available = property.rooms.filter((r) => free.has(r.id));

  // The guest's language, never the staff cookie: a manager reading the
  // workspace in English must not flip a stranger's page. See
  // src/lib/guestLocale.ts.
  const propertyAmenities = amenityNames(property.amenities, locale);
  const houseRules = (property.houseRules ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

  const vars = themeVars(property.theme, property.brandColor);
  const tokens = THEMES[property.theme];

  return (
    // Every colour on this page comes from these variables. The host picks one
    // of four presets and optionally one accent; nothing else here is theirs to
    // set, which is what keeps the page readable whatever they choose.
    <I18nProvider dict={dictFor(locale)}>
    <div style={vars as React.CSSProperties} className="min-h-dvh bg-[var(--bg)] text-[var(--ink)]">
      <main className="mx-auto w-full max-w-3xl px-5 py-12">
        <header>
          {property.logoFile ? (
            // Plain img, not next/image: the file is uploaded to the VPS at
            // runtime, so there is no build-time size to optimise against and
            // nothing for the optimiser to do but add a hop.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/tai-len/${property.logoFile}`}
              alt={property.orgName}
              className="mb-5 h-12 w-auto object-contain"
            />
          ) : null}

          <div className="mb-4 flex justify-end gap-3 text-[13px]">
            {/* Two plain links rather than a form: switching language is a
                navigation, so the English page has a URL of its own that a
                guest can bookmark or send on. */}
            {(["vi", "en"] as const).map((code) => (
              <a
                key={code}
                href={`/dat/${slug}${withLocale(params, code)}`}
                hrefLang={code}
                aria-current={locale === code ? "true" : undefined}
                className={
                  locale === code
                    ? "font-semibold text-[var(--ink)] underline underline-offset-4"
                    : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
                }
              >
                {code === "vi" ? "Tiếng Việt" : "English"}
              </a>
            ))}
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">
            {t("Đặt trực tiếp · không qua trung gian")}
          </p>
          <h1
            className="mt-2 text-[2rem] font-semibold leading-tight"
            style={{ fontFamily: tokens.display }}
          >
            {property.name}
          </h1>
          {property.type || property.address ? (
            <p className="mt-1 text-[15px] text-[var(--ink-soft)]">
              {/* Type first: "Homestay" and "Resort" set different
                  expectations before a guest reads a word of the description. */}
              {property.type
                ? t(
                    PROPERTY_TYPE_LABELS[
                      property.type as keyof typeof PROPERTY_TYPE_LABELS
                    ],
                  )
                : null}
              {property.type && property.address ? " · " : null}
              {property.address}
            </p>
          ) : null}
          {property.intro ? (
            <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[var(--ink-soft)]">
              {property.intro}
            </p>
          ) : null}
        </header>

        <section className="mt-10">
          <h2 className="text-[1.125rem] font-semibold">{t("Chọn ngày")}</h2>
          <p className="mt-1 text-[14px] text-[var(--ink-soft)]">
            {fill(t("Đang xem {tu} – {den}"), {
              tu: shortDate(from, locale),
              den: shortDate(to, locale),
            })}{" "}
            · <span className="tnum">{fill(t("{n} đêm"), { n: nights })}</span>
          </p>

          {/* A plain GET form: changing dates is a navigation, so the result
              has a URL a guest can bookmark or send to whoever they are
              travelling with. */}
          <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="tu" className="block text-[13px] font-medium">
                {t("Nhận phòng")}
              </label>
              <input
                id="tu"
                name="tu"
                type="date"
                defaultValue={toIsoDate(from)}
                min={toIsoDate(today)}
                className="mt-1.5 min-h-11 border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[16px] text-[var(--ink)]"
                style={{ borderRadius: "calc(var(--radius) * 0.6)" }}
              />
            </div>
            <div>
              <label htmlFor="den" className="block text-[13px] font-medium">
                {t("Trả phòng")}
              </label>
              <input
                id="den"
                name="den"
                type="date"
                defaultValue={toIsoDate(to)}
                min={toIsoDate(addDays(from, 1))}
                className="mt-1.5 min-h-11 border border-[var(--line)] bg-[var(--surface)] px-3.5 text-[16px] text-[var(--ink)]"
                style={{ borderRadius: "calc(var(--radius) * 0.6)" }}
              />
            </div>
            <button
              type="submit"
              className="min-h-11 border border-[var(--line)] bg-[var(--surface)] px-5 text-[14px] font-medium"
              style={{ borderRadius: "999px" }}
            >
              {t("Xem phòng trống")}
            </button>
          </form>
        </section>

        <section className="mt-10">
          <h2 className="text-[1.125rem] font-semibold">
            {available.length > 0
              ? fill(t("{n} phòng còn trống"), { n: available.length })
              : t("Không còn phòng trống")}
          </h2>

          {available.length === 0 ? (
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--ink-soft)]">
              {t("Những đêm này đã kín. Thử đổi ngày ở trên — hoặc nhắn trực tiếp cho chủ nhà, có thể còn cách khác.")}
            </p>
          ) : (
            <ul className="mt-4 space-y-4">
              {available.map((room) => (
                <li
                  key={room.id}
                  className="border border-[var(--line)] bg-[var(--surface)] p-6"
                  style={{ borderRadius: "var(--radius)" }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3
                        className="text-[17px] font-semibold"
                        style={{ fontFamily: tokens.display }}
                      >
                        {room.name}
                      </h3>
                      <p className="mt-0.5 text-[14px] text-[var(--ink-soft)]">
                        {fill(t("Tối đa {n} khách"), { n: room.capacity })}
                      </p>
                      {room.description ? (
                        <p className="mt-2 max-w-xl whitespace-pre-line text-[14px] leading-relaxed text-[var(--ink-soft)]">
                          {room.description}
                        </p>
                      ) : null}
                    </div>
                    {room.basePrice !== null ? (
                      <p className="text-right">
                        <span className="text-[18px] font-semibold tnum">
                          {formatMoney(room.basePrice, property.currency, locale)}
                        </span>
                        <span className="block text-[13px] text-[var(--ink-soft)]">
                          {t("mỗi đêm")}
                        </span>
                      </p>
                    ) : null}
                  </div>

                  {room.basePrice !== null ? (
                    <p className="mt-3 border-t border-[var(--line)] pt-3 text-[14px]">
                      {fill(t("{n} đêm"), { n: nights })} ·{" "}
                      <span className="font-semibold tnum">
                        {formatMoney(
                          room.basePrice * nights,
                          property.currency,
                          locale,
                        )}
                      </span>
                    </p>
                  ) : null}

                  {room.amenities.length > 0 ? (
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--ink-soft)]">
                      {amenityNames(room.amenities, locale).map((name) => (
                        <li key={name}>· {name}</li>
                      ))}
                    </ul>
                  ) : null}

                  <BookingWidget
                    action={requestBooking}
                    slug={slug}
                    roomId={room.id}
                    checkIn={toIsoDate(from)}
                    checkOut={toIsoDate(to)}
                    maxGuests={room.capacity}
                    locale={locale}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {propertyAmenities.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-[1.125rem] font-semibold">{t("Tiện nghi")}</h2>
            <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {propertyAmenities.map((name) => (
                <li key={name} className="text-[15px] text-[var(--ink-soft)]">
                  · {name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {houseRules.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-[1.125rem] font-semibold">{t("Nội quy lưu trú")}</h2>
            <ul className="mt-4 space-y-1.5">
              {houseRules.map((rule) => (
                <li key={rule} className="text-[15px] leading-relaxed text-[var(--ink-soft)]">
                  · {rule}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="mt-14 border-t border-[var(--line)] pt-6 text-[13px] leading-relaxed text-[var(--ink-soft)]">
          {t("Đặt trực tiếp với chủ nhà. Không phí nền tảng, không hoa hồng — số tiền bạn trả là số tiền chủ nhà nhận.")}
        </footer>
      </main>
    </div>
    </I18nProvider>
  );
}
