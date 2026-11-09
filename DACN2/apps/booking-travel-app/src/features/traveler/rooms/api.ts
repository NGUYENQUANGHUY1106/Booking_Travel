import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/api-client";
import type { PublicRoom, PublicRoomDetail, RoomGalleryImage } from "./types";

type LegacyRoomResponse = PublicRoom & {
  amenityDetails?: PublicRoom["amenityDetails"] | null;
  gallery?: RoomGalleryImage[] | null;
  images?: RoomGalleryImage[] | null;
};

function normalizeRoom<T extends LegacyRoomResponse>(room: T): T & PublicRoom {
  return {
    ...room,
    amenities: Array.isArray(room.amenities) ? room.amenities : [],
    amenityDetails: Array.isArray(room.amenityDetails)
      ? room.amenityDetails
      : (room.amenities ?? []).map((id) => ({ id, name: id })),
    gallery: Array.isArray(room.gallery)
      ? room.gallery
      : Array.isArray(room.images)
        ? room.images
        : [],
  };
}

export function usePublicRooms(hotelId?: string) {
  return useQuery({
    queryKey: ["public-rooms", hotelId],
    queryFn: async () => {
      const response = await apiClient.get<LegacyRoomResponse[]>(
        `/hotels/${hotelId}/rooms`,
      );
      return response.data.map(normalizeRoom);
    },
    enabled: Boolean(hotelId),
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}

export function usePublicRoom(roomId?: string) {
  return useQuery({
    queryKey: ["public-room", roomId],
    queryFn: async () => {
      const response = await apiClient.get<PublicRoomDetail & LegacyRoomResponse>(
        `/rooms/${roomId}`,
      );
      return normalizeRoom(response.data) as PublicRoomDetail;
    },
    enabled: Boolean(roomId),
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}
