export const NEARBY_PLACE_CATEGORIES = [
  { value: "ATTRACTION", label: "Tham quan" },
  { value: "BEACH", label: "Bãi biển" },
  { value: "FOOD", label: "Ăn uống" },
  { value: "SHOPPING", label: "Mua sắm" },
  { value: "TRANSPORT", label: "Giao thông" },
  { value: "HEALTHCARE", label: "Y tế" },
  { value: "EDUCATION", label: "Giáo dục" },
] as const;

export type NearbyPlaceCategory =
  (typeof NEARBY_PLACE_CATEGORIES)[number]["value"];

export function formatNearbyDistance(distanceMeters: number) {
  if (distanceMeters < 1_000) return `${distanceMeters} m`;
  return `${(distanceMeters / 1_000).toFixed(distanceMeters < 10_000 ? 1 : 0)} km`;
}

export function nearbyPlaceMapUrl(place: {
  name: string;
  address: string | null;
  latitude: string;
  longitude: string;
}) {
  const query = place.address
    ? `${place.name}, ${place.address}`
    : `${place.latitude},${place.longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
