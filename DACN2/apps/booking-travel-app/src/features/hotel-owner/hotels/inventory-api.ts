import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";

export type InventoryDay = {
  date: string;
  totalRooms: number;
  effectiveCapacity: number;
  sellableOverride: number | null;
  booked: number;
  blocked: number;
  available: number;
};
export type InventoryBlock = {
  id: string;
  startDate: string;
  endDateExclusive: string;
  quantity: number;
  reason: string;
  version: number;
};
export type InventoryBooking = {
  id: string;
  code: string;
  checkIn: string;
  checkOut: string;
  roomCount: number;
  status: string;
};
export type InventoryMonth = {
  hotelId: string;
  roomId: string;
  roomName: string;
  totalRooms: number;
  revision: number;
  month: string;
  days: InventoryDay[];
  blocks: InventoryBlock[];
  bookings: InventoryBooking[];
};

export const inventoryKey = (
  userId: string,
  hotelId: string,
  roomId: string,
  month: string,
) => ["owner-inventory", userId, hotelId, roomId, month] as const;
const path = (hotelId: string, roomId: string) =>
  `/owner/hotels/${hotelId}/rooms/${roomId}/inventory`;

export function useInventoryMonth(
  userId?: string,
  hotelId?: string,
  roomId?: string,
  month?: string,
) {
  return useQuery({
    queryKey: inventoryKey(
      userId ?? "",
      hotelId ?? "",
      roomId ?? "",
      month ?? "",
    ),
    queryFn: async () =>
      (
        await apiClient.get<InventoryMonth>(path(hotelId!, roomId!), {
          params: { month },
        })
      ).data,
    enabled: Boolean(userId && hotelId && roomId && month),
    refetchOnMount: "always",
  });
}

export const inventoryApi = {
  createBlock: async (
    hotelId: string,
    roomId: string,
    input: {
      startDate: string;
      endDateExclusive: string;
      quantity: number;
      reason: string;
      expectedRevision: number;
      idempotencyKey: string;
    },
  ) => (await apiClient.post(path(hotelId, roomId) + "/blocks", input)).data,
  updateBlock: async (
    hotelId: string,
    roomId: string,
    blockId: string,
    input: {
      startDate: string;
      endDateExclusive: string;
      quantity: number;
      reason: string;
      expectedRevision: number;
      expectedVersion: number;
      idempotencyKey: string;
    },
  ) =>
    (await apiClient.patch(path(hotelId, roomId) + `/blocks/${blockId}`, input))
      .data,
  releaseBlock: async (
    hotelId: string,
    roomId: string,
    blockId: string,
    input: {
      expectedRevision: number;
      expectedVersion: number;
      idempotencyKey: string;
    },
  ) =>
    (
      await apiClient.delete(path(hotelId, roomId) + `/blocks/${blockId}`, {
        data: input,
      })
    ).data,
  setOverride: async (
    hotelId: string,
    roomId: string,
    input: {
      startDate: string;
      endDateExclusive: string;
      sellableQty: number | null;
      expectedRevision: number;
      idempotencyKey: string;
    },
  ) => (await apiClient.put(path(hotelId, roomId) + "/override", input)).data,
};
