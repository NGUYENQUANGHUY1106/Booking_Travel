import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export type OwnerPromotion = {
  id: string; code: string; hotelId: string; title: string; description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ENDED'; effectiveStatus: string;
  discountType: 'PERCENT' | 'FIXED'; discountValue: string; maxDiscount: string | null;
  currency: 'VND'; startsAt: string; endsAt: string; stayStart: string; stayEnd: string;
  roomIds: string[]; minNights: number; quota: number; reservedCount: number;
  consumedCount: number; remaining: number; version: number;
};
export type OwnerPromotionInput = Pick<OwnerPromotion, 'title' | 'discountType' | 'discountValue' | 'currency' | 'startsAt' | 'endsAt' | 'minNights' | 'quota' | 'roomIds'> & {
  code?: string; description?: string; maxDiscount?: string; stayStart: string; stayEnd: string;
};
export type PromotionPreview = { currency: string; roomSubtotal: string; discount: string; finalAmount: string; eligibleDates: string[]; reasonCode: string | null; previewAt: string; nightlyRates: { date: string; price: string }[] };
const path = (hotelId: string) => `/owner/hotels/${hotelId}/promotions`;
export const promotionKey = (userId: string, hotelId: string) => ['owner-promotions', userId, hotelId] as const;
export function useOwnerPromotions(userId?: string, hotelId?: string, status?: string, page = 1) {
  return useQuery({
    queryKey: [...promotionKey(userId ?? '', hotelId ?? ''), status ?? 'ALL', page],
    queryFn: async () => (await apiClient.get<{ items: OwnerPromotion[]; total: number }>(path(hotelId!), { params: { status: status === 'ALL' ? undefined : status, page } })).data,
    enabled: Boolean(userId && hotelId), refetchOnMount: 'always',
  });
}
export const promotionsApi = {
  preview: async (hotelId: string, input: OwnerPromotionInput & { roomId: string; checkIn: string; checkOut: string; roomCount: number }) =>
    (await apiClient.post<PromotionPreview>(`${path(hotelId)}/preview`, input)).data,
  get: async (hotelId: string, id: string) => (await apiClient.get<OwnerPromotion>(`${path(hotelId)}/${id}`)).data,
  create: async (hotelId: string, input: OwnerPromotionInput) => (await apiClient.post<OwnerPromotion>(path(hotelId), input)).data,
  update: async (hotelId: string, id: string, input: OwnerPromotionInput & { version: number }) => (await apiClient.patch<OwnerPromotion>(`${path(hotelId)}/${id}`, input)).data,
  action: async (hotelId: string, id: string, action: 'activate' | 'pause' | 'end', version: number, reason?: string) =>
    (await apiClient.post<OwnerPromotion>(`${path(hotelId)}/${id}/${action}`, { version, reason })).data,
};
