import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/api-client";
import type { PublicRoom, PublicRoomDetail } from "./types";

export function usePublicRooms(hotelId?: string) {
  return useQuery({
    queryKey: ["public-rooms", hotelId],
    queryFn: async () =>
      (await apiClient.get<PublicRoom[]>(`/hotels/${hotelId}/rooms`)).data,
    enabled: Boolean(hotelId),
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}

export function usePublicRoom(roomId?: string) {
  return useQuery({
    queryKey: ["public-room", roomId],
    queryFn: async () =>
      (await apiClient.get<PublicRoomDetail>(`/rooms/${roomId}`)).data,
    enabled: Boolean(roomId),
    staleTime: 30_000,
    refetchOnMount: "always",
  });
}
