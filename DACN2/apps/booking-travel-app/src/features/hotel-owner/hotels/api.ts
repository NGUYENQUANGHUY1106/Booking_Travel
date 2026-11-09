import { useQuery } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { apiClient } from '@/services/api-client';
import { absoluteMediaUrl } from '@/services/media-url';

export { absoluteMediaUrl } from '@/services/media-url';

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
  district: string | null;
  ward: string | null;
  provinceUnitId: string | null;
  districtUnitId: string | null;
  wardUnitId: string | null;
  latitude: string | null;
  longitude: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  coverImageUrl: string | null;
  status: OwnerHotelStatus;
  isVisible: boolean;
  profileVersion: number;
  roomCount: number;
  bookingCount: number;
  policy: { cancellationPolicy: string | null; houseRules: string | null } | null;
  amenities: string[];
  gallery: HotelImage[];
  completion: { basic: boolean; contact: boolean; location: boolean; media: boolean; policy: boolean; rooms: boolean };
  readyForReview: boolean;
  canSubmit: boolean;
  checklist: { code: keyof OwnerHotelProfile['completion']; label: string; targetStep: string; complete: boolean; reason: string | null; required: boolean }[];
  latestSubmission: { id: string; version: number; status: string; reason: string | null; submittedAt: string; decidedAt: string | null } | null;
  latestRestriction?: { action: 'HIDE' | 'SUSPEND' | 'RESTORE'; reason: string; createdAt: string; futureBookingCount: number } | null;
  updatedAt: string;
};

export type HotelImage = { id: string; mimeType: string; sizeBytes: number; sortOrder: number; isCover: boolean; url: string };
export type Amenity = { id: string; name: string; active: boolean };

export type HotelProfileChanges = Partial<Pick<OwnerHotelProfile, 'name' | 'accommodationType' | 'description' | 'contactEmail' | 'contactPhone' | 'checkInTime' | 'checkOutTime'>> & {
  policy?: { cancellationPolicy?: string | null; houseRules?: string | null };
  amenityIds?: string[];
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
  location: async (hotelId: string, input: { expectedVersion: number; addressLine?: string | null; provinceUnitId?: string | null; districtUnitId?: string | null; wardUnitId?: string | null; latitude?: number | null; longitude?: number | null }) =>
    (await apiClient.patch<OwnerHotelProfile>(`/owner/hotels/${hotelId}/location`, input)).data,
  catalog: async () => (await apiClient.get<Amenity[]>('/owner/hotels/catalog/amenities')).data,
  amenities: async (hotelId: string, expectedVersion: number, amenityIds: string[]) =>
    (await apiClient.put<OwnerHotelProfile>(`/owner/hotels/${hotelId}/amenities`, { expectedVersion, amenityIds })).data,
  submit: async (hotelId: string, expectedVersion: number) =>
    (await apiClient.post<OwnerHotelProfile>(`/owner/hotels/${hotelId}/submit`, { expectedVersion })).data,
  async uploadImage(hotelId: string, asset: ImagePickerAsset, onProgress: (value: number) => void, onReserved: (mediaId: string) => void, onUploaded: () => void) {
    const mimeType = asset.mimeType || (asset.uri.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1].toLowerCase() === 'png' ? 'image/png' : asset.uri.match(/\.webp(?:\?|$)/i) ? 'image/webp' : 'image/jpeg');
    const sizeBytes = asset.fileSize ?? (Platform.OS === 'web' ? asset.file?.size : new File(asset.uri).size);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Ảnh phải là JPG, PNG hoặc WebP.');
    if (!sizeBytes || sizeBytes < 8 || sizeBytes > 10 * 1024 * 1024) throw new Error('Ảnh phải từ 8 byte đến 10 MB.');
    const reservation = (await apiClient.post<{ mediaId: string; uploadUrl: string }>(`/owner/hotels/${hotelId}/media/presign`, { mimeType, sizeBytes })).data;
    onReserved(reservation.mediaId);
    const uploadUrl = absoluteMediaUrl(reservation.uploadUrl);
    if (Platform.OS === 'web') {
      if (!asset.file) throw new Error('Không đọc được ảnh đã chọn.');
      const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: asset.file });
      if (!response.ok) throw new Error('Không tải được ảnh.');
      onProgress(100);
    } else {
      const task = FileSystem.createUploadTask(uploadUrl, asset.uri, { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: { 'Content-Type': mimeType } }, ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) onProgress(Math.round(totalBytesSent / totalBytesExpectedToSend * 100));
      });
      const result = await task.uploadAsync();
      if (!result || result.status < 200 || result.status >= 300) throw new Error('Không tải được ảnh.');
    }
    onUploaded();
    return (await apiClient.post<OwnerHotelProfile>(`/owner/hotels/${hotelId}/media/finalize`, { mediaId: reservation.mediaId })).data;
  },
  finalizeImage: async (hotelId: string, mediaId: string) => (await apiClient.post<OwnerHotelProfile>(`/owner/hotels/${hotelId}/media/finalize`, { mediaId })).data,
  coverImage: async (hotelId: string, expectedVersion: number, mediaId: string) => (await apiClient.patch<OwnerHotelProfile>(`/owner/hotels/${hotelId}/media/cover`, { expectedVersion, mediaId })).data,
  reorderImages: async (hotelId: string, expectedVersion: number, mediaIds: string[]) => (await apiClient.put<OwnerHotelProfile>(`/owner/hotels/${hotelId}/media/order`, { expectedVersion, mediaIds })).data,
  removeImage: async (hotelId: string, expectedVersion: number, mediaId: string) => (await apiClient.delete<OwnerHotelProfile>(`/owner/hotels/${hotelId}/media/${mediaId}`, { data: { expectedVersion } })).data,
};
