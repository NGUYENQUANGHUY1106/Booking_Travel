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

export type PublicHotelRoom = {
  id: string;
  hotelId: string;
  name: string;
  type: string;
  description: string | null;
  capacityAdults: number;
  capacityChildren: number;
  bedInfo: string;
  areaM2: string | null;
  quantity: number;
  basePrice: string;
  currency: string;
  amenities: string[];
  gallery: { id: string; url: string; sortOrder: number; isCover: boolean }[];
};

export type PublicRoom = PublicHotelRoom & {
  amenityLabels?: string[];
  images: { id: string; url: string; sortOrder: number; isCover: boolean }[];
};

export function usePublicRoomAvailability(
  roomId: string,
  checkIn: string,
  checkOut: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(checkIn) &&
    /^\d{4}-\d{2}-\d{2}$/.test(checkOut) &&
    checkIn >= today &&
    checkOut > checkIn;
  return useQuery({
    queryKey: ['public-room-availability', roomId, checkIn, checkOut],
    queryFn: async () =>
      (
        await apiClient.get<{
          availableRooms: number;
          basePrice: string;
          currency: string;
        }>(`/rooms/${roomId}/availability`, {
          params: { checkIn, checkOut },
        })
      ).data,
    enabled: Boolean(roomId && valid),
    staleTime: 10_000,
  });
}

export type PublicHotelDetail = PublicHotel & {
  district: string | null;
  ward: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  policy: {
    cancellationPolicy: string | null;
    houseRules: string | null;
  } | null;
  rooms: PublicHotelRoom[];
  reviewSummary: null;
  reviews: [];
};

export function publicMediaUrl(path: string) {
  return absoluteMediaUrl(path);
}

async function fetchPublicHotels(search = "", checkIn?: string, checkOut?: string, rooms?: number) {
  const response = await apiClient.get<PublicHotel[]>("/hotels", {
    params: { search: search.trim() || undefined, checkIn, checkOut, rooms },
  });
  return response.data;
}

export function usePublicHotelDiscovery(search = "", checkIn?: string, checkOut?: string, rooms?: number) {
  return useQuery({
    queryKey: [
      "public-hotel-discovery",
      search.trim().toLocaleLowerCase("vi-VN"),
      checkIn,
      checkOut,
      rooms,
    ],
    queryFn: () => fetchPublicHotels(search, checkIn, checkOut, rooms),
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}

export function usePublicHotels(
  destination: string,
  center?: { latitude: number; longitude: number },
  checkIn?: string,
  checkOut?: string,
  rooms?: number,
) {
  return useQuery({
    queryKey: [
      "public-hotels",
      destination,
      center?.latitude,
      center?.longitude,
      checkIn,
      checkOut,
      rooms,
    ],
    queryFn: async () =>
      (
        await apiClient.get<PublicHotel[]>("/hotels", {
          params: {
            search: destination.trim() || undefined,
            latitude: center?.latitude,
            longitude: center?.longitude,
            radiusKm: center ? 25 : undefined,
            checkIn,
            checkOut,
            rooms,
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
      (await apiClient.get<PublicHotelDetail>(`/hotels/${id}`)).data,
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
