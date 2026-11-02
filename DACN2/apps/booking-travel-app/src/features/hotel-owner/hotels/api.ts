import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/services/api-client';

export type AccommodationType = 'HOTEL' | 'RESORT' | 'APARTMENT' | 'VILLA' | 'HOMESTAY' | 'HOSTEL';
export type OwnerHotelStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type OwnerHotelProfile = {
  id: string;
  ownerId: string;
  name: string;
  accommodationType: AccommodationType | null;
  description: string | null;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  coverImageUrl: string | null;
  status: OwnerHotelStatus;
  profileVersion: number;
  roomCount: number;
  bookingCount: number;
  policy: { cancellationPolicy: string | null; houseRules: string | null } | null;
  completion: { basic: boolean; contact: boolean; location: boolean; media: boolean; policy: boolean; rooms: boolean };
  readyForReview: boolean;
  updatedAt: string;
};

export type HotelProfileChanges = Partial<Pick<OwnerHotelProfile, 'name' | 'accommodationType' | 'description' | 'contactEmail' | 'contactPhone' | 'checkInTime' | 'checkOutTime'>> & {
  policy?: { cancellationPolicy?: string | null; houseRules?: string | null };
};

export const ownerHotelListKey = (userId: string) => ['owner-hotels', userId] as const;
export const ownerHotelKey = (userId: string, hotelId: string) => [...ownerHotelListKey(userId), hotelId] as const;

export function useOwnerHotels(userId?: string) {
  return useQuery({
    queryKey: ownerHotelListKey(userId ?? ''),
    queryFn: async () => (await apiClient.get<OwnerHotelProfile[]>('/owner/hotels')).data,
    enabled: Boolean(userId),
    staleTime: 10_000,
    refetchOnMount: 'always',
  });
}

export function useOwnerHotel(userId?: string, hotelId?: string) {
  return useQuery({
    queryKey: ownerHotelKey(userId ?? '', hotelId ?? ''),
    queryFn: async () => (await apiClient.get<OwnerHotelProfile>(`/owner/hotels/${hotelId}`)).data,
    enabled: Boolean(userId && hotelId),
    staleTime: 10_000,
    refetchOnMount: 'always',
  });
}

export const ownerHotelApi = {
  createDraft: async (input: { clientDraftId: string; name: string; accommodationType: AccommodationType; description?: string }) =>
    (await apiClient.post<OwnerHotelProfile>('/owner/hotels', input)).data,
  updateProfile: async (hotelId: string, expectedVersion: number, changes: HotelProfileChanges) =>
    (await apiClient.patch<OwnerHotelProfile>(`/owner/hotels/${hotelId}`, { expectedVersion, ...changes })).data,
  removeDraft: async (hotelId: string) => { await apiClient.delete(`/owner/hotels/${hotelId}`); },
};
