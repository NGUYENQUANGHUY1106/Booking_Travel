import type { PublicRoom, RoomFilters } from "./types";

export const EMPTY_ROOM_FILTERS: RoomFilters = {
  sort: "priceAsc",
  classes: [],
  views: [],
  beds: [],
  amenities: [],
};

export function applyRoomFilters(rooms: PublicRoom[], filters: RoomFilters) {
  const filtered = rooms.filter((room) => {
    const bedTypes = Array.isArray(room.bedConfigurations)
      ? room.bedConfigurations.map((bed) => bed.bedType)
      : [];
    return (
      (!filters.classes.length ||
        Boolean(room.classCode && filters.classes.includes(room.classCode))) &&
      (!filters.views.length ||
        Boolean(room.viewCode && filters.views.includes(room.viewCode))) &&
      (!filters.beds.length ||
        filters.beds.every((bed) => bedTypes.includes(bed))) &&
      (!filters.amenities.length ||
        filters.amenities.every((amenity) => room.amenities.includes(amenity)))
    );
  });
  return [...filtered].sort((left, right) => {
    if (filters.sort === "priceDesc")
      return Number(right.basePrice) - Number(left.basePrice);
    if (filters.sort === "capacityDesc")
      return (
        right.capacityAdults + right.capacityChildren -
        (left.capacityAdults + left.capacityChildren)
      );
    return Number(left.basePrice) - Number(right.basePrice);
  });
}
