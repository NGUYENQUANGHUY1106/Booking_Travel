import type { PublicAccommodationType, PublicHotel } from "./public-hotels";

export const ACCOMMODATION_TYPE_LABELS: Record<
  PublicAccommodationType,
  string
> = {
  HOTEL: "Khách sạn",
  RESORT: "Resort",
  APARTMENT: "Căn hộ",
  VILLA: "Villa",
  HOMESTAY: "Homestay",
  HOSTEL: "Hostel",
};

export type DiscoveryCategory = PublicAccommodationType | "ALL";

export function validStaySearch(
  destination: string,
  checkIn: string,
  checkOut: string,
  adults: number,
  children: number,
  rooms: number,
) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    Boolean(destination.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkIn) &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkOut) &&
    checkIn >= today &&
    checkOut > checkIn &&
    Number.isInteger(adults) &&
    adults >= 1 &&
    Number.isInteger(children) &&
    children >= 0 &&
    Number.isInteger(rooms) &&
    rooms >= 1
  );
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

export function filterDiscoveryHotels(
  hotels: readonly PublicHotel[],
  keyword: string,
  category: DiscoveryCategory,
) {
  const query = normalize(keyword);
  return hotels.filter((hotel) => {
    const categoryMatches =
      category === "ALL" || hotel.accommodationType === category;
    if (!categoryMatches) return false;
    if (!query) return true;
    return [hotel.name, hotel.addressLine, hotel.city, hotel.province].some(
      (value) => value && normalize(value).includes(query),
    );
  });
}

export function publicHotelPrice(hotel: PublicHotel) {
  if (!hotel.minPricePerNight) return undefined;
  const value = Number(hotel.minPricePerNight);
  return Number.isFinite(value) ? value : undefined;
}

export function sortDiscoveryHotels(hotels: readonly PublicHotel[]) {
  return [...hotels].sort((left, right) => {
    if (right.starRating !== left.starRating)
      return right.starRating - left.starRating;
    if (right.roomCount !== left.roomCount)
      return right.roomCount - left.roomCount;
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

export function splitDiscoveryHotels(hotels: readonly PublicHotel[]) {
  const sorted = sortDiscoveryHotels(hotels);
  return {
    featured: sorted.slice(0, 3),
    recommended: sorted.slice(3),
  };
}

export type DestinationGroup = {
  name: string;
  count: number;
  coverImageUrl: string | null;
};

export function groupHotelDestinations(hotels: readonly PublicHotel[]) {
  const groups = new Map<string, DestinationGroup>();
  for (const hotel of hotels) {
    const name = hotel.city?.trim() || hotel.province?.trim();
    if (!name) continue;
    const current = groups.get(name);
    groups.set(name, {
      name,
      count: (current?.count ?? 0) + 1,
      coverImageUrl: current?.coverImageUrl ?? hotel.coverImageUrl,
    });
  }
  return [...groups.values()].sort(
    (left, right) =>
      right.count - left.count || left.name.localeCompare(right.name, "vi"),
  );
}
