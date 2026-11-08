import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/api-client";
import { absoluteMediaUrl } from "@/services/media-url";

export type PublicAccommodationType =
  "HOTEL" | "RESORT" | "APARTMENT" | "VILLA" | "HOMESTAY" | "HOSTEL";

export type PublicHotel = {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  latitude: string | null;
  longitude: string | null;
  description: string | null;
  coverImageUrl: string | null;
  accommodationType: PublicAccommodationType | null;
  starRating: number;
  roomCount: number;
  minPricePerNight: string | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
  amenities: { id: string; name: string }[];
  gallery?: { id: string; url: string; sortOrder: number; isCover: boolean }[];
};

export function publicMediaUrl(path: string) {
  return absoluteMediaUrl(path);
}

async function fetchPublicHotels(search = "") {
  const response = await apiClient.get<PublicHotel[]>("/hotels", {
    params: { search: search.trim() || undefined },
  });
  return response.data;
}

export function usePublicHotelDiscovery(search = "") {
  return useQuery({
    queryKey: [
      "public-hotel-discovery",
      search.trim().toLocaleLowerCase("vi-VN"),
    ],
    queryFn: () => fetchPublicHotels(search),
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}

export function usePublicHotels(
  destination: string,
  center?: { latitude: number; longitude: number },
) {
  return useQuery({
    queryKey: [
      "public-hotels",
      destination,
      center?.latitude,
      center?.longitude,
    ],
    queryFn: async () =>
      (
        await apiClient.get<PublicHotel[]>("/hotels", {
          params: {
            search: destination.trim() || undefined,
            latitude: center?.latitude,
            longitude: center?.longitude,
            radiusKm: center ? 25 : undefined,
          },
        })
      ).data.filter(
        (hotel) => hotel.latitude !== null && hotel.longitude !== null,
      ),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function usePublicHotel(id: string) {
  return useQuery({
    queryKey: ["public-hotel", id],
    queryFn: async () =>
      (await apiClient.get<PublicHotel>(`/hotels/${id}`)).data,
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
