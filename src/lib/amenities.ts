/**
 * The amenity catalogue the property wizard picks from.
 *
 * Names live here in both languages rather than in src/i18n/en.ts, for the
 * same reason the country list does: the dictionary is keyed by Vietnamese
 * *sentences* and is the right home for "Đặt tên cho chỗ nghỉ." — it is the
 * wrong home for a hundred-odd catalogue entries that are data a host picks
 * from, not copy anyone will rewrite.
 *
 * Ids are what reach the database. The label is Vietnamese today and may be
 * rewritten tomorrow; a row that stored "Bãi đỗ xe máy" would have to be
 * migrated for that, and a row that stored "parking-motorbike" would not.
 *
 * Scope decides which of the two pickers an amenity appears in. Some things
 * are genuinely both — a room has Wi-Fi and so does the lobby — and listing
 * them twice under different ids would make "Wi-Fi" mean two things.
 *
 * Deliberately shorter than the list the design was taken from, which carries
 * around 1,200 entries lifted from Airbnb's vocabulary and still largely in
 * English ("Windsurfers", "Putting Green", "Cotton Candy Machine"). A picker
 * that long is a picker nobody reads to the end of, and half-translated labels
 * are worse than none. This is the set a Vietnamese host actually offers.
 */

export const AMENITY_CATEGORIES = {
  BASIC: { vi: "Cơ bản", en: "Basics" },
  BATHROOM: { vi: "Phòng tắm", en: "Bathroom" },
  BEDROOM: { vi: "Phòng ngủ & giặt là", en: "Bedroom & laundry" },
  ENTERTAINMENT: { vi: "Giải trí", en: "Entertainment" },
  FAMILY: { vi: "Gia đình", en: "Family" },
  CLIMATE: { vi: "Sưởi & làm mát", en: "Heating & cooling" },
  SAFETY: { vi: "An toàn", en: "Safety" },
  INTERNET: { vi: "Internet & làm việc", en: "Internet & workspace" },
  KITCHEN: { vi: "Bếp & ăn uống", en: "Kitchen & dining" },
  LOCATION: { vi: "Vị trí", en: "Location" },
  OUTDOOR: { vi: "Ngoài trời", en: "Outdoor" },
  PARKING: { vi: "Đỗ xe & tiện ích", en: "Parking & facilities" },
  ACCESS: { vi: "Hỗ trợ tiếp cận", en: "Accessibility" },
  SERVICE: { vi: "Dịch vụ", en: "Services" },
} as const;

export type AmenityCategory = keyof typeof AMENITY_CATEGORIES;

/** Which picker an amenity belongs in. */
export type AmenityScope = "property" | "room" | "both";

export type Amenity = {
  id: string;
  vi: string;
  en: string;
  category: AmenityCategory;
  scope: AmenityScope;
};

export const AMENITIES: readonly Amenity[] = [
  /* --- Cơ bản ---------------------------------------------------------- */
  { id: "wifi", vi: "Wi-Fi", en: "Wi-Fi", category: "BASIC", scope: "both" },
  { id: "essentials", vi: "Đồ dùng thiết yếu", en: "Essentials", category: "BASIC", scope: "room" },
  { id: "self-checkin", vi: "Tự nhận phòng", en: "Self check-in", category: "BASIC", scope: "property" },
  { id: "checkin-24h", vi: "Nhận phòng 24/24", en: "24-hour check-in", category: "BASIC", scope: "property" },
  { id: "private-entrance", vi: "Lối vào riêng", en: "Private entrance", category: "BASIC", scope: "room" },
  { id: "keycard", vi: "Khóa thẻ từ", en: "Keycard lock", category: "BASIC", scope: "room" },
  { id: "smoking-allowed", vi: "Cho phép hút thuốc", en: "Smoking allowed", category: "BASIC", scope: "property" },
  { id: "pets-allowed", vi: "Cho phép mang thú cưng", en: "Pets allowed", category: "BASIC", scope: "property" },
  { id: "events-allowed", vi: "Cho phép tổ chức sự kiện", en: "Events allowed", category: "BASIC", scope: "property" },
  { id: "luggage-storage", vi: "Giữ hành lý", en: "Luggage storage", category: "BASIC", scope: "property" },

  /* --- Phòng tắm ------------------------------------------------------- */
  { id: "private-bathroom", vi: "Phòng tắm riêng", en: "Private bathroom", category: "BATHROOM", scope: "room" },
  { id: "shared-bathroom", vi: "Phòng tắm chung", en: "Shared bathroom", category: "BATHROOM", scope: "room" },
  { id: "hot-water", vi: "Nước nóng", en: "Hot water", category: "BATHROOM", scope: "room" },
  { id: "bathtub", vi: "Bồn tắm", en: "Bathtub", category: "BATHROOM", scope: "room" },
  { id: "hair-dryer", vi: "Máy sấy tóc", en: "Hair dryer", category: "BATHROOM", scope: "room" },
  { id: "toiletries", vi: "Đồ vệ sinh cá nhân", en: "Toiletries", category: "BATHROOM", scope: "room" },
  { id: "towels", vi: "Khăn tắm", en: "Towels", category: "BATHROOM", scope: "room" },
  { id: "bidet", vi: "Vòi xịt vệ sinh", en: "Bidet", category: "BATHROOM", scope: "room" },
  { id: "slippers", vi: "Dép đi trong phòng", en: "Slippers", category: "BATHROOM", scope: "room" },

  /* --- Phòng ngủ & giặt là --------------------------------------------- */
  { id: "bed-linen", vi: "Ga trải giường", en: "Bed linen", category: "BEDROOM", scope: "room" },
  { id: "extra-pillows", vi: "Gối và chăn dự phòng", en: "Extra pillows and blankets", category: "BEDROOM", scope: "room" },
  { id: "wardrobe", vi: "Tủ quần áo", en: "Wardrobe", category: "BEDROOM", scope: "room" },
  { id: "hangers", vi: "Móc treo quần áo", en: "Hangers", category: "BEDROOM", scope: "room" },
  { id: "blackout-curtains", vi: "Rèm chắn sáng", en: "Blackout curtains", category: "BEDROOM", scope: "room" },
  { id: "mosquito-net", vi: "Màn chống muỗi", en: "Mosquito net", category: "BEDROOM", scope: "room" },
  { id: "iron", vi: "Bàn là", en: "Iron", category: "BEDROOM", scope: "room" },
  { id: "washer", vi: "Máy giặt", en: "Washing machine", category: "BEDROOM", scope: "both" },
  { id: "dryer", vi: "Máy sấy quần áo", en: "Clothes dryer", category: "BEDROOM", scope: "both" },
  { id: "drying-rack", vi: "Giá phơi đồ", en: "Drying rack", category: "BEDROOM", scope: "both" },
  { id: "safe", vi: "Két sắt", en: "Safe", category: "BEDROOM", scope: "room" },

  /* --- Giải trí -------------------------------------------------------- */
  { id: "tv", vi: "TV", en: "TV", category: "ENTERTAINMENT", scope: "room" },
  { id: "smart-tv", vi: "TV thông minh", en: "Smart TV", category: "ENTERTAINMENT", scope: "room" },
  { id: "cable-tv", vi: "Truyền hình cáp", en: "Cable TV", category: "ENTERTAINMENT", scope: "room" },
  { id: "sound-system", vi: "Dàn âm thanh", en: "Sound system", category: "ENTERTAINMENT", scope: "property" },
  { id: "books", vi: "Sách và tạp chí", en: "Books and magazines", category: "ENTERTAINMENT", scope: "property" },
  { id: "board-games", vi: "Trò chơi bàn cờ", en: "Board games", category: "ENTERTAINMENT", scope: "property" },
  { id: "karaoke", vi: "Karaoke", en: "Karaoke", category: "ENTERTAINMENT", scope: "property" },
  { id: "pool-table", vi: "Bàn bi-a", en: "Pool table", category: "ENTERTAINMENT", scope: "property" },

  /* --- Gia đình -------------------------------------------------------- */
  { id: "crib", vi: "Nôi em bé", en: "Crib", category: "FAMILY", scope: "room" },
  { id: "extra-bed", vi: "Giường phụ", en: "Extra bed", category: "FAMILY", scope: "room" },
  { id: "high-chair", vi: "Ghế ăn cho bé", en: "High chair", category: "FAMILY", scope: "property" },
  { id: "baby-bath", vi: "Chậu tắm cho bé", en: "Baby bath", category: "FAMILY", scope: "property" },
  { id: "outlet-covers", vi: "Nắp che ổ điện", en: "Outlet covers", category: "FAMILY", scope: "room" },
  { id: "stair-gate", vi: "Cổng chắn cầu thang", en: "Stair gate", category: "FAMILY", scope: "property" },
  { id: "toys", vi: "Đồ chơi trẻ em", en: "Children's toys", category: "FAMILY", scope: "property" },
  { id: "playground", vi: "Khu vui chơi trẻ em", en: "Children's playground", category: "FAMILY", scope: "property" },

  /* --- Sưởi & làm mát -------------------------------------------------- */
  { id: "air-conditioning", vi: "Điều hòa", en: "Air conditioning", category: "CLIMATE", scope: "room" },
  { id: "ceiling-fan", vi: "Quạt trần", en: "Ceiling fan", category: "CLIMATE", scope: "room" },
  { id: "standing-fan", vi: "Quạt cây", en: "Standing fan", category: "CLIMATE", scope: "room" },
  { id: "heating", vi: "Máy sưởi", en: "Heating", category: "CLIMATE", scope: "room" },
  { id: "water-heater", vi: "Bình nóng lạnh", en: "Water heater", category: "CLIMATE", scope: "room" },
  { id: "dehumidifier", vi: "Máy hút ẩm", en: "Dehumidifier", category: "CLIMATE", scope: "room" },

  /* --- An toàn --------------------------------------------------------- */
  { id: "smoke-alarm", vi: "Báo khói", en: "Smoke alarm", category: "SAFETY", scope: "both" },
  { id: "co-alarm", vi: "Báo khí CO", en: "Carbon monoxide alarm", category: "SAFETY", scope: "both" },
  { id: "fire-extinguisher", vi: "Bình chữa cháy", en: "Fire extinguisher", category: "SAFETY", scope: "property" },
  { id: "first-aid-kit", vi: "Túi sơ cứu", en: "First aid kit", category: "SAFETY", scope: "property" },
  { id: "security-camera", vi: "Camera an ninh khu vực chung", en: "Security cameras in common areas", category: "SAFETY", scope: "property" },
  { id: "security-24h", vi: "Bảo vệ 24/24", en: "24-hour security", category: "SAFETY", scope: "property" },
  { id: "emergency-exit", vi: "Lối thoát hiểm", en: "Emergency exit", category: "SAFETY", scope: "property" },
  { id: "window-guards", vi: "Lan can, chắn cửa sổ", en: "Window guards", category: "SAFETY", scope: "room" },

  /* --- Internet & làm việc --------------------------------------------- */
  { id: "workspace", vi: "Bàn làm việc", en: "Workspace", category: "INTERNET", scope: "room" },
  { id: "ethernet", vi: "Cổng mạng dây", en: "Wired internet", category: "INTERNET", scope: "room" },
  { id: "printer", vi: "Máy in", en: "Printer", category: "INTERNET", scope: "property" },
  { id: "meeting-room", vi: "Phòng họp", en: "Meeting room", category: "INTERNET", scope: "property" },
  { id: "coworking", vi: "Không gian làm việc chung", en: "Coworking space", category: "INTERNET", scope: "property" },

  /* --- Bếp & ăn uống --------------------------------------------------- */
  { id: "kitchen", vi: "Bếp", en: "Kitchen", category: "KITCHEN", scope: "both" },
  { id: "kitchenette", vi: "Bếp nhỏ trong phòng", en: "Kitchenette", category: "KITCHEN", scope: "room" },
  { id: "fridge", vi: "Tủ lạnh", en: "Refrigerator", category: "KITCHEN", scope: "room" },
  { id: "minibar", vi: "Minibar", en: "Minibar", category: "KITCHEN", scope: "room" },
  { id: "microwave", vi: "Lò vi sóng", en: "Microwave", category: "KITCHEN", scope: "both" },
  { id: "stove", vi: "Bếp nấu", en: "Stove", category: "KITCHEN", scope: "both" },
  { id: "rice-cooker", vi: "Nồi cơm điện", en: "Rice cooker", category: "KITCHEN", scope: "both" },
  { id: "kettle", vi: "Ấm đun nước", en: "Electric kettle", category: "KITCHEN", scope: "room" },
  { id: "coffee-maker", vi: "Máy pha cà phê", en: "Coffee maker", category: "KITCHEN", scope: "both" },
  { id: "cookware", vi: "Xoong nồi, bát đĩa", en: "Cookware and dishes", category: "KITCHEN", scope: "both" },
  { id: "dining-table", vi: "Bàn ăn", en: "Dining table", category: "KITCHEN", scope: "both" },
  { id: "water-dispenser", vi: "Cây nước nóng lạnh", en: "Water dispenser", category: "KITCHEN", scope: "property" },
  { id: "breakfast", vi: "Bữa sáng", en: "Breakfast", category: "KITCHEN", scope: "property" },
  { id: "restaurant", vi: "Nhà hàng", en: "Restaurant", category: "KITCHEN", scope: "property" },
  { id: "bar", vi: "Quầy bar", en: "Bar", category: "KITCHEN", scope: "property" },

  /* --- Vị trí ---------------------------------------------------------- */
  { id: "beachfront", vi: "Sát biển", en: "Beachfront", category: "LOCATION", scope: "property" },
  { id: "beach-access", vi: "Lối ra biển", en: "Beach access", category: "LOCATION", scope: "property" },
  { id: "lake-access", vi: "Lối ra hồ", en: "Lake access", category: "LOCATION", scope: "property" },
  { id: "riverside", vi: "Ven sông", en: "Riverside", category: "LOCATION", scope: "property" },
  { id: "mountain-view", vi: "View núi", en: "Mountain view", category: "LOCATION", scope: "room" },
  { id: "sea-view", vi: "View biển", en: "Sea view", category: "LOCATION", scope: "room" },
  { id: "city-view", vi: "View thành phố", en: "City view", category: "LOCATION", scope: "room" },
  { id: "garden-view", vi: "View vườn", en: "Garden view", category: "LOCATION", scope: "room" },
  { id: "city-centre", vi: "Trung tâm thành phố", en: "City centre", category: "LOCATION", scope: "property" },

  /* --- Ngoài trời ------------------------------------------------------ */
  { id: "pool", vi: "Hồ bơi", en: "Swimming pool", category: "OUTDOOR", scope: "property" },
  { id: "private-pool", vi: "Hồ bơi riêng", en: "Private pool", category: "OUTDOOR", scope: "room" },
  { id: "hot-tub", vi: "Bồn sục", en: "Hot tub", category: "OUTDOOR", scope: "property" },
  { id: "garden", vi: "Sân vườn", en: "Garden", category: "OUTDOOR", scope: "property" },
  { id: "terrace", vi: "Sân thượng", en: "Terrace", category: "OUTDOOR", scope: "property" },
  { id: "balcony", vi: "Ban công", en: "Balcony", category: "OUTDOOR", scope: "room" },
  { id: "bbq", vi: "Khu nướng BBQ", en: "BBQ area", category: "OUTDOOR", scope: "property" },
  { id: "outdoor-furniture", vi: "Bàn ghế ngoài trời", en: "Outdoor furniture", category: "OUTDOOR", scope: "property" },
  { id: "sun-loungers", vi: "Ghế tắm nắng", en: "Sun loungers", category: "OUTDOOR", scope: "property" },
  { id: "campfire", vi: "Khu đốt lửa trại", en: "Fire pit", category: "OUTDOOR", scope: "property" },

  /* --- Đỗ xe & tiện ích ------------------------------------------------ */
  { id: "parking-motorbike", vi: "Bãi đỗ xe máy", en: "Motorbike parking", category: "PARKING", scope: "property" },
  { id: "parking-car", vi: "Bãi đỗ ô tô", en: "Car parking", category: "PARKING", scope: "property" },
  { id: "parking-free", vi: "Đỗ xe miễn phí", en: "Free parking", category: "PARKING", scope: "property" },
  { id: "ev-charger", vi: "Trạm sạc xe điện", en: "EV charger", category: "PARKING", scope: "property" },
  { id: "elevator", vi: "Thang máy", en: "Elevator", category: "PARKING", scope: "property" },
  { id: "gym", vi: "Phòng gym", en: "Gym", category: "PARKING", scope: "property" },
  { id: "spa", vi: "Spa", en: "Spa", category: "PARKING", scope: "property" },
  { id: "sauna", vi: "Phòng xông hơi", en: "Sauna", category: "PARKING", scope: "property" },
  { id: "bike-rental", vi: "Thuê xe đạp", en: "Bicycle rental", category: "PARKING", scope: "property" },
  { id: "motorbike-rental", vi: "Thuê xe máy", en: "Motorbike rental", category: "PARKING", scope: "property" },
  { id: "generator", vi: "Máy phát điện", en: "Backup generator", category: "PARKING", scope: "property" },

  /* --- Hỗ trợ tiếp cận ------------------------------------------------- */
  { id: "step-free-entrance", vi: "Lối vào không bậc thang", en: "Step-free entrance", category: "ACCESS", scope: "property" },
  { id: "wide-doorway", vi: "Cửa rộng cho xe lăn", en: "Wheelchair-width doorway", category: "ACCESS", scope: "room" },
  { id: "ground-floor", vi: "Phòng tầng trệt", en: "Ground-floor room", category: "ACCESS", scope: "room" },
  { id: "grab-rails", vi: "Tay vịn trong phòng tắm", en: "Bathroom grab rails", category: "ACCESS", scope: "room" },
  { id: "roll-in-shower", vi: "Vòi sen không bậc", en: "Roll-in shower", category: "ACCESS", scope: "room" },
  { id: "accessible-parking", vi: "Chỗ đỗ xe cho người khuyết tật", en: "Accessible parking", category: "ACCESS", scope: "property" },
  { id: "lit-path", vi: "Lối vào có đèn chiếu sáng", en: "Lit path to the entrance", category: "ACCESS", scope: "property" },

  /* --- Dịch vụ --------------------------------------------------------- */
  { id: "reception-24h", vi: "Lễ tân 24/24", en: "24-hour reception", category: "SERVICE", scope: "property" },
  { id: "front-desk", vi: "Quầy lễ tân", en: "Front desk", category: "SERVICE", scope: "property" },
  { id: "housekeeping", vi: "Dọn phòng hằng ngày", en: "Daily housekeeping", category: "SERVICE", scope: "property" },
  { id: "laundry-service", vi: "Dịch vụ giặt là", en: "Laundry service", category: "SERVICE", scope: "property" },
  { id: "room-service", vi: "Phục vụ tại phòng", en: "Room service", category: "SERVICE", scope: "property" },
  { id: "airport-shuttle", vi: "Đưa đón sân bay", en: "Airport shuttle", category: "SERVICE", scope: "property" },
  { id: "tour-desk", vi: "Đặt tour, vé tham quan", en: "Tour desk", category: "SERVICE", scope: "property" },
  { id: "car-rental", vi: "Thuê ô tô có tài xế", en: "Car hire with driver", category: "SERVICE", scope: "property" },
  { id: "invoice", vi: "Xuất hóa đơn VAT", en: "VAT invoice", category: "SERVICE", scope: "property" },
  { id: "concierge", vi: "Hỗ trợ khách 24/24", en: "24-hour guest support", category: "SERVICE", scope: "property" },
];

const BY_ID = new Map(AMENITIES.map((a) => [a.id, a]));

export const CATEGORY_ORDER = Object.keys(AMENITY_CATEGORIES) as AmenityCategory[];

/** The amenities one picker offers, in catalogue order. */
export function amenitiesFor(scope: "property" | "room"): Amenity[] {
  return AMENITIES.filter((a) => a.scope === scope || a.scope === "both");
}

/**
 * Names for a list of stored ids, in the reader's language.
 *
 * Unknown ids are dropped rather than shown raw. Retiring an amenity from the
 * catalogue then costs nothing: the properties that had it stop listing it,
 * instead of every page suddenly printing "bike-rental" at a guest.
 */
export function amenityNames(ids: readonly string[], lang: "vi" | "en"): string[] {
  return ids.map((id) => BY_ID.get(id)?.[lang]).filter((v): v is string => Boolean(v));
}

/** Drops anything the catalogue does not know, and any duplicate. */
export function keepKnownAmenities(ids: readonly string[]): string[] {
  return [...new Set(ids)].filter((id) => BY_ID.has(id));
}

/** What a new property starts with ticked, matching the reference design. */
export const DEFAULT_PROPERTY_AMENITIES = ["wifi", "parking-motorbike"];
export const DEFAULT_ROOM_AMENITIES = ["wifi", "private-bathroom", "air-conditioning"];
