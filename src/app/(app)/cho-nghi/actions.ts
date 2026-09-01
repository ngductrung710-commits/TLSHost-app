"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireMember } from "@/lib/dal";
import { keepKnownAmenities } from "@/lib/amenities";
import { isCountryCode } from "@/lib/countries";
import { CURRENCY_CODES } from "@/lib/currencies";
import { withOrg } from "@/lib/db";
import { LIMIT_MESSAGES } from "@/lib/plans";
import { fill } from "@/lib/i18n";
import { getT } from "@/lib/locale";
import { PROPERTY_TYPES } from "@/lib/propertyTypes";

export type PropertyState = { error: string | null };

/**
 * A textarea posts CRLF, whatever you typed into it.
 *
 * The HTML spec says so, and the stored house rules came back as
 * "Nhận phòng sau 14:00\r\nTrả phòng trước 11:00". Nothing renders wrong, so
 * it survives review — until something splits on "\n" to count the rules or
 * list them, and every line but the last carries an invisible \r that turns
 * "14:00" into "14:00\r" in a comparison, an export, or an iCal field.
 */
const lines = (text: string) => text.replaceAll("\r\n", "\n");

/**
 * What the five-step wizard posts.
 *
 * Everything arrives as strings because it arrives as FormData; the coercions
 * here are the only place that changes. Optional fields are `.trim()`ed and
 * turned into null at the end rather than stored as "" — an empty string in a
 * nullable column is a value that reads as present and prints as nothing.
 */
const schema = z.object({
  name: z.string().trim().min(1, "Đặt tên cho cơ sở."),
  type: z.enum(PROPERTY_TYPES).nullable().catch(null),
  currency: z.string().refine((c) => CURRENCY_CODES.includes(c), {
    message: "Chưa chọn được tiền tệ.",
  }),

  addressLine1: z.string().trim().min(1, "Điền số nhà và tên đường."),
  addressLine2: z.string().trim(),
  city: z.string().trim().min(1, "Điền thành phố."),
  region: z.string().trim(),
  postalCode: z.string().trim(),
  // Unknown codes fall back to Vietnam rather than rejecting: the value comes
  // from a <select> this app renders, so a bad one means something is wrong on
  // our side, and blocking the host is the wrong way to find out.
  countryCode: z.string().transform((c) => (isCountryCode(c) ? c : "VN")),

  roomName: z.string().trim().min(1, "Đặt tên cho loại phòng."),
  roomDescription: z.string().trim().transform(lines),
  roomCount: z.coerce.number().int().min(1).max(200),
  // Empty means "not priced yet", which is a real state: the room still takes
  // bookings, the guest just sees no figure.
  basePrice: z
    .union([z.literal(""), z.coerce.number().int().min(0)])
    .transform((v) => (v === "" ? null : v)),
  maxAdults: z.coerce.number().int().min(1).max(30),
  maxChildren: z.coerce.number().int().min(0).max(30),

  intro: z.string().trim().transform(lines),
  houseRules: z.string().trim().transform(lines),
});

/** The one line every screen shows, composed once so the screens agree. */
function composeAddress(parts: {
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
}): string {
  return [
    parts.addressLine1,
    parts.addressLine2,
    parts.city,
    parts.region,
    parts.postalCode,
  ]
    .filter((p) => p !== "")
    .join(", ");
}

function parseIds(raw: FormDataEntryValue | null): string[] {
  try {
    const value: unknown = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(value)) return [];
    return keepKnownAmenities(value.filter((v): v is string => typeof v === "string"));
  } catch {
    // A malformed amenity list is not worth failing the creation over — the
    // host loses some ticks, not the property.
    return [];
  }
}

export async function createProperty(
  _prev: PropertyState,
  formData: FormData,
): Promise<PropertyState> {
  const t = await getT();
  const member = await requireMember();

  // Only an owner shapes the inventory. A collaborator manages bookings inside
  // the properties they were given; letting them add properties would put
  // rooms outside anyone's scope.
  if (member.role !== "OWNER") {
    return { error: t("Chỉ chủ nhà mới thêm được cơ sở.") };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || null,
    currency: formData.get("currency") ?? "VND",
    addressLine1: formData.get("addressLine1") ?? "",
    addressLine2: formData.get("addressLine2") ?? "",
    city: formData.get("city") ?? "",
    region: formData.get("region") ?? "",
    postalCode: formData.get("postalCode") ?? "",
    countryCode: formData.get("countryCode") ?? "VN",
    roomName: formData.get("roomName"),
    roomDescription: formData.get("roomDescription") ?? "",
    roomCount: formData.get("roomCount") ?? "1",
    basePrice: formData.get("basePrice") ?? "",
    maxAdults: formData.get("maxAdults") ?? "2",
    maxChildren: formData.get("maxChildren") ?? "0",
    intro: formData.get("intro") ?? "",
    houseRules: formData.get("houseRules") ?? "",
  });
  if (!parsed.success) {
    return { error: t(parsed.error.issues[0]?.message ?? "Thông tin chưa hợp lệ.") };
  }
  const data = parsed.data;

  const propertyAmenities = parseIds(formData.get("propertyAmenities"));
  const roomAmenities = parseIds(formData.get("roomAmenities"));

  // Counted at the moment of creation, not cached on the org. A limit that
  // reads a stale counter is a limit that can be walked past by opening two
  // tabs.
  const max = member.limits.maxProperties;
  if (max !== null) {
    const existing = await withOrg(member.orgId, (tx) => tx.property.count());
    if (existing >= max) {
      return { error: fill(t(LIMIT_MESSAGES.properties), { n: max }) };
    }
  }

  /**
   * One room type, many rooms.
   *
   * The wizard asks for a room type and a count, the way an OTA extranet does.
   * This app has no room-type table: a Room is the bookable thing, which is
   * what lets the overlap constraint have exactly one shape. So a count of
   * five becomes five rooms, numbered — and a count of one stays unnumbered,
   * because "An Bàng Villa 1" is a silly name for the only villa.
   */
  const rooms = Array.from({ length: data.roomCount }, (_, i) => ({
    orgId: member.orgId,
    name: data.roomCount === 1 ? data.roomName : `${data.roomName} ${i + 1}`,
    capacity: data.maxAdults + data.maxChildren,
    maxAdults: data.maxAdults,
    maxChildren: data.maxChildren,
    basePrice: data.basePrice,
    description: data.roomDescription || null,
    amenities: roomAmenities,
  }));

  await withOrg(member.orgId, async (tx) => {
    await tx.property.create({
      data: {
        orgId: member.orgId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        address: composeAddress(data) || null,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 || null,
        city: data.city,
        region: data.region || null,
        postalCode: data.postalCode || null,
        countryCode: data.countryCode,
        intro: data.intro || null,
        houseRules: data.houseRules || null,
        amenities: propertyAmenities,
        rooms: { create: rooms },
      },
    });
  });

  revalidatePath("/cho-nghi");
  revalidatePath("/lich");
  redirect("/cho-nghi");
}
