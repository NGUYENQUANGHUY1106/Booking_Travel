import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/services/api-client';

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
  amenities: { id: string; name: string }[];
  gallery?: { id: string; url: string; sortOrder: number; isCover: boolean }[];
  rooms?: PublicRoom[];
};

export type PublicRoom = {
  id: string;
  name: string;
  type: string;
  bedInfo: string;
  areaM2: string | null;
  capacityAdults: number;
  capacityChildren: number;
  quantity: number;
  basePrice: string;
  currency: string;
  description: string | null;
  amenities: string[];
  amenityLabels?: string[];
  images: { id: string; url: string; sortOrder: number; isCover: boolean }[];
};

export function usePublicRoomAvailability(roomId: string, checkIn: string, checkOut: string) {
  const today = new Date().toISOString().slice(0, 10);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && checkIn >= today && checkOut > checkIn;
  return useQuery({
    queryKey: ['public-room-availability', roomId, checkIn, checkOut],
    queryFn: async () => (await apiClient.get<{ availableRooms: number; basePrice: string; currency: string }>(`/rooms/${roomId}/availability`, { params: { checkIn, checkOut } })).data,
    enabled: Boolean(roomId && valid),
    staleTime: 10_000,
  });
}

export function publicMediaUrl(path: string) {
  return /^https?:\/\//.test(path) ? path : new URL(path, apiClient.defaults.baseURL).toString();
}

export function usePublicHotels(destination: string, center?: { latitude: number; longitude: number }) {
  return useQuery({
    queryKey: ['public-hotels', destination, center?.latitude, center?.longitude],
    queryFn: async () => (await apiClient.get<PublicHotel[]>('/hotels', { params: {
      search: destination.trim() || undefined,
      latitude: center?.latitude,
      longitude: center?.longitude,
      radiusKm: center ? 25 : undefined,
    } })).data.filter((hotel) => hotel.latitude !== null && hotel.longitude !== null),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function usePublicHotel(id: string) {
  return useQuery({
    queryKey: ['public-hotel', id],
    queryFn: async () => (await apiClient.get<PublicHotel>(`/hotels/${id}`)).data,
    enabled: Boolean(id),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
