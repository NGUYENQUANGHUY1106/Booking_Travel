import { useQuery } from '@tanstack/react-query';
import type { ImagePickerAsset } from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { apiClient } from '@/services/api-client';
import { absoluteMediaUrl, type HotelImage } from './api';

export type RoomCatalogOption = { code: string; label: string; group?: string };
export type RoomCatalog = {
  classes: RoomCatalogOption[];
  views: RoomCatalogOption[];
  beds: RoomCatalogOption[];
};
export type BedConfiguration = { bedType: string; quantity: number };
export type OwnerRoom = {
  id: string;
  hotelId: string;
  name: string;
  type: string;
  description: string | null;
  classCode: string | null;
  viewCode: string | null;
  bedConfigurations: BedConfiguration[] | null;
  areaM2: string | null;
  capacityAdults: number;
  capacityChildren: number;
  bedInfo: string;
  quantity: number;
  basePrice: string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  amenities: string[];
};
export type RoomChanges = {
  name: string;
  type: string;
  classCode?: string;
  viewCode?: string;
  bedConfigurations?: BedConfiguration[];
  bedInfo: string;
  areaM2?: number;
  capacityAdults: number;
  capacityChildren: number;
  quantity: number;
  basePrice: number;
  currency: 'VND';
  amenities?: string[];
};

export const ownerRoomKey = (userId: string, hotelId: string) => ['owner-rooms', userId, hotelId] as const;
export const ownerRoomMediaKey = (userId: string, hotelId: string, roomId: string) => [...ownerRoomKey(userId, hotelId), roomId, 'media'] as const;

export function useOwnerRooms(userId?: string, hotelId?: string) {
  return useQuery({
    queryKey: ownerRoomKey(userId ?? '', hotelId ?? ''),
    queryFn: async () => (await apiClient.get<OwnerRoom[]>(`/hotels/${hotelId}/rooms`)).data,
    enabled: Boolean(userId && hotelId),
    refetchOnMount: 'always',
  });
}

export function useRoomCatalog() {
  return useQuery({
    queryKey: ['room-catalog'],
    queryFn: async () => (await apiClient.get<RoomCatalog>('/rooms/catalog')).data,
    staleTime: 60 * 60_000,
  });
}

export function useOwnerRoomMedia(userId?: string, hotelId?: string, roomId?: string) {
  return useQuery({
    queryKey: ownerRoomMediaKey(userId ?? '', hotelId ?? '', roomId ?? ''),
    queryFn: async () => (await apiClient.get<HotelImage[]>(`/owner/hotels/${hotelId}/rooms/${roomId}/media`)).data,
    enabled: Boolean(userId && hotelId && roomId),
    refetchOnMount: 'always',
  });
}

export const ownerRoomApi = {
  create: async (hotelId: string, changes: RoomChanges) =>
    (await apiClient.post<OwnerRoom>(`/hotels/${hotelId}/rooms`, changes)).data,
  update: async (roomId: string, changes: Partial<RoomChanges>) =>
    (await apiClient.patch<OwnerRoom>(`/rooms/${roomId}`, changes)).data,
  status: async (roomId: string, status: OwnerRoom['status']) =>
    (await apiClient.patch<OwnerRoom>(`/rooms/${roomId}`, { status })).data,
  removeImage: async (hotelId: string, roomId: string, mediaId: string) =>
    (await apiClient.delete<HotelImage[]>(`/owner/hotels/${hotelId}/rooms/${roomId}/media/${mediaId}`)).data,
  async uploadImage(hotelId: string, roomId: string, asset: ImagePickerAsset, onProgress: (value: number) => void, onReserved: (id: string) => void, onUploaded: () => void) {
    const mimeType = asset.mimeType || (asset.uri.match(/\.png(?:\?|$)/i) ? 'image/png' : asset.uri.match(/\.webp(?:\?|$)/i) ? 'image/webp' : 'image/jpeg');
    const sizeBytes = asset.fileSize ?? (Platform.OS === 'web' ? asset.file?.size : new File(asset.uri).size);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || !sizeBytes || sizeBytes < 8 || sizeBytes > 10 * 1024 * 1024)
      throw new Error('Ảnh phòng phải là JPG, PNG hoặc WebP từ 8 byte đến 10 MB.');
    const path = `/owner/hotels/${hotelId}/rooms/${roomId}/media`;
    const reservation = (await apiClient.post<{ mediaId: string; uploadUrl: string }>(`${path}/presign`, { mimeType, sizeBytes })).data;
    onReserved(reservation.mediaId);
    const uploadUrl = absoluteMediaUrl(reservation.uploadUrl);
    if (Platform.OS === 'web') {
      if (!asset.file) throw new Error('Không đọc được ảnh đã chọn.');
      const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: asset.file });
      if (!response.ok) throw new Error('Không tải được ảnh phòng.');
      onProgress(100);
    } else {
      const task = FileSystem.createUploadTask(uploadUrl, asset.uri, { httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: { 'Content-Type': mimeType } }, ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) onProgress(Math.round(totalBytesSent / totalBytesExpectedToSend * 100));
      });
      const result = await task.uploadAsync();
      if (!result || result.status < 200 || result.status >= 300) throw new Error('Không tải được ảnh phòng.');
    }
    onUploaded();
    return (await apiClient.post<HotelImage[]>(`${path}/finalize`, { mediaId: reservation.mediaId })).data;
  },
  finalizeImage: async (hotelId: string, roomId: string, mediaId: string) =>
    (await apiClient.post<HotelImage[]>(`/owner/hotels/${hotelId}/rooms/${roomId}/media/finalize`, { mediaId })).data,
};
