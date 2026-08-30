/**
 * The kinds of place a host can list.
 *
 * Keys are Vietnamese, like every other label in this codebase, so a missing
 * translation renders as a real word rather than "propertyType.BOUTIQUE_HOTEL".
 * See src/lib/i18n.ts.
 */
export const PROPERTY_TYPE_LABELS = {
  HOTEL: "Khách sạn",
  BOUTIQUE_HOTEL: "Khách sạn boutique",
  HOMESTAY: "Homestay",
  VILLA: "Biệt thự",
  APARTMENT: "Căn hộ",
  GUESTHOUSE: "Nhà nghỉ",
  RESORT: "Resort",
  HOSTEL: "Hostel",
} as const;

export type PropertyTypeKey = keyof typeof PROPERTY_TYPE_LABELS;

export const PROPERTY_TYPES = Object.keys(
  PROPERTY_TYPE_LABELS,
) as PropertyTypeKey[];
