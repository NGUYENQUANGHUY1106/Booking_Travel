import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/api-client";
import type { NearbyPlaceCategory } from "./nearby-place-model";

export {
  NEARBY_PLACE_CATEGORIES,
  formatNearbyDistance,
  nearbyPlaceMapUrl,
  type NearbyPlaceCategory,
} from "./nearby-place-model";

export type NearbyPlace = {
  id: string;
  name: string;
  address: string | null;
  category: NearbyPlaceCategory;
  latitude: string;
  longitude: string;
  distanceMeters: number;
  sourceUrl: string | null;
};

export type NearbyPlacesResponse = {
  hotel: {
    id: string;
    name: string;
    latitude: string | null;
    longitude: string | null;
  };
  radiusMeters: number;
  source: "CACHE" | "PROVIDER" | "UNAVAILABLE";
  stale: boolean;
  hasLocation: boolean;
  items: NearbyPlace[];
  groups: {
    category: NearbyPlaceCategory;
    label: string;
    items: NearbyPlace[];
  }[];
  attribution: {
    provider: string;
    text: string;
    url: string;
  };
  refreshedAt: string | null;
};

export function useNearbyPlaces(
  hotelId: string,
  category?: NearbyPlaceCategory,
  limit = 20,
) {
  return useQuery({
    queryKey: ["hotel-nearby-places", hotelId, category ?? "ALL", limit],
    queryFn: async () =>
      (
        await apiClient.get<NearbyPlacesResponse>(
          `/hotels/${hotelId}/nearby-places`,
          { params: { category, limit } },
        )
      ).data,
    enabled: Boolean(hotelId),
    staleTime: 5 * 60_000,
  });
}
