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
};

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
