import type { DocumentPickerAsset } from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { apiClient } from '@/services/api-client';

export type ApplicationStatus = 'DRAFT' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
export type DocumentPurpose = 'IDENTITY' | 'BUSINESS_LICENSE';
export type PrivateDocument = { id: string; purpose: DocumentPurpose; status: 'RESERVED' | 'READY'; mimeType: string; expectedSize: number };
export type OwnerApplication = {
  id: string;
  status: ApplicationStatus;
  version: number;
  revision: number;
  businessName: string | null;
  businessAddress: string | null;
  representativeName: string | null;
  businessRegistrationNumber: string | null;
  businessPhone: string | null;
  identityDocumentId: string | null;
  businessLicenseDocumentId: string | null;
  identityDocument: PrivateDocument | null;
  businessLicenseDocument: PrivateDocument | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type OwnerCurrent = {
  applicant: { id: string; fullName: string; email: string | null; phone: string | null; emailVerified: boolean; phoneVerified: boolean };
  application: OwnerApplication | null;
  ownerEntitlementActive: boolean;
};
export type OwnerDecisionNotification = {
  id: string; title: string; body: string; version: number;
  createdAt: string; readAt: string | null;
};
export type OwnerDraftInput = Partial<Pick<OwnerApplication,
  'businessName' | 'businessAddress' | 'representativeName' | 'businessRegistrationNumber' | 'businessPhone' | 'identityDocumentId' | 'businessLicenseDocumentId'
>> & { expectedRevision?: number };

export const ownerApplicationKey = (userId: string) => ['owner-application', userId] as const;

export function useOwnerCurrent(userId?: string) {
  return useQuery({
    queryKey: ownerApplicationKey(userId ?? ''),
    queryFn: async ({ signal }) => (await apiClient.get<OwnerCurrent>('/owner-applications/me', { signal })).data,
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry: (attempt, error) => attempt < 1 && !(isAxiosError(error) && [400, 401, 403, 404].includes(error.response?.status ?? 0)),
  });
}

export function useOwnerNotifications(userId?: string) {
  return useQuery({
    queryKey: ['owner-application-notifications', userId ?? ''],
    queryFn: async () => (await apiClient.get<OwnerDecisionNotification[]>('/owner-applications/me/notifications')).data,
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });
}

export const ownerApplicationApi = {
  async createDraft() { return (await apiClient.post<OwnerApplication>('/owner-applications')).data; },
  async updateDraft(id: string, input: OwnerDraftInput) { return (await apiClient.patch<OwnerApplication>(`/owner-applications/${id}`, input)).data; },
  async submit(id: string, expectedVersion?: number, expectedRevision?: number) { return (await apiClient.post<OwnerApplication>(`/owner-applications/${id}/submit`, { expectedVersion, expectedRevision })).data; },
  async upload(asset: DocumentPickerAsset, purpose: DocumentPurpose, onProgress: (value: number) => void, onUploaded: (mediaId: string) => void) {
    const mimeType = asset.mimeType && ['image/jpeg', 'image/png', 'application/pdf'].includes(asset.mimeType) ? asset.mimeType : inferMimeType(asset.name);
    const sizeBytes = asset.size ?? (Platform.OS === 'web' ? asset.file?.size : new File(asset.uri).size);
    if (!mimeType || !['image/jpeg', 'image/png', 'application/pdf'].includes(mimeType)) throw new Error('Tệp phải là JPG, PNG hoặc PDF.');
    if (!sizeBytes || sizeBytes < 8 || sizeBytes > 10 * 1024 * 1024) throw new Error('Tệp không hợp lệ hoặc lớn hơn 10 MB.');

    const { data: reservation } = await apiClient.post<{ mediaId: string; uploadUrl: string }>('/media/presign', {
      purpose, mimeType, sizeBytes,
    });
    if (Platform.OS === 'web') {
      if (!asset.file) throw new Error('Không thể đọc tệp đã chọn.');
      const response = await fetch(reservation.uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType }, body: asset.file });
      if (!response.ok) throw new Error('Không thể tải tài liệu lên. Vui lòng thử lại.');
      onProgress(100);
    } else {
      const task = FileSystem.createUploadTask(reservation.uploadUrl, asset.uri, {
        httpMethod: 'PUT', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': mimeType },
      }, ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) onProgress(Math.round(totalBytesSent / totalBytesExpectedToSend * 100));
      });
      const result = await task.uploadAsync();
      if (!result || result.status < 200 || result.status >= 300) throw new Error('Không thể tải tài liệu lên. Vui lòng thử lại.');
    }
    onUploaded(reservation.mediaId);
    return this.finalize(reservation.mediaId);
  },
  async finalize(mediaId: string) { return (await apiClient.post<PrivateDocument>(`/media/${mediaId}/finalize`)).data; },
};

function inferMimeType(name: string) {
  if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
  if (/\.png$/i.test(name)) return 'image/png';
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  return null;
}
