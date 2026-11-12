import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';

export type PricingKind = 'DATE' | 'HOLIDAY' | 'SEASON' | 'WEEKDAY' | 'WEEKEND';
export type PricingRule = {
  id: string;
  kind: PricingKind;
  label: string | null;
  startDate: string;
  endDateExclusive: string;
  price: string;
  active: boolean;
};
export type PricingDay = {
  date: string;
  price: string;
  source: PricingKind | 'BASE';
  ruleId: string | null;
  booked: number;
  blocked: number;
  available: number;
  closedForSale: boolean;
};
export type PricingMonth = {
  hotelId: string;
  roomId: string;
  roomName: string;
  currency: string;
  basePrice: string;
  version: number;
  month: string;
  days: PricingDay[];
  rules: PricingRule[];
};
export type PricingRuleInput = {
  kind: PricingKind;
  label?: string;
  startDate: string;
  endDateExclusive: string;
  price: string;
  expectedVersion: number;
};
export type PricingPreview = {
  roomId: string;
  version: number;
  currency: string;
  days: { date: string; before: string; after: string; source: string; changed: boolean }[];
};

const path = (hotelId: string, roomId: string) => `/owner/hotels/${hotelId}/rooms/${roomId}/pricing`;
export const pricingKey = (userId: string, hotelId: string, roomId: string) => ['owner-pricing', userId, hotelId, roomId] as const;

export function usePricingMonth(userId?: string, hotelId?: string, roomId?: string, month?: string) {
  return useQuery({
    queryKey: [...pricingKey(userId ?? '', hotelId ?? '', roomId ?? ''), month],
    queryFn: async () => (await apiClient.get<PricingMonth>(path(hotelId!, roomId!), { params: { month } })).data,
    enabled: Boolean(userId && hotelId && roomId && month),
    refetchOnMount: 'always',
  });
}

export const pricingApi = {
  preview: async (hotelId: string, roomId: string, input: PricingRuleInput) =>
    (await apiClient.post<PricingPreview>(`${path(hotelId, roomId)}/preview`, input)).data,
  create: async (hotelId: string, roomId: string, input: PricingRuleInput) =>
    (await apiClient.post(`${path(hotelId, roomId)}/rules`, input)).data,
  update: async (hotelId: string, roomId: string, ruleId: string, input: PricingRuleInput) =>
    (await apiClient.patch(`${path(hotelId, roomId)}/rules/${ruleId}`, input)).data,
  remove: async (hotelId: string, roomId: string, ruleId: string, expectedVersion: number) =>
    (await apiClient.delete(`${path(hotelId, roomId)}/rules/${ruleId}`, { data: { expectedVersion } })).data,
  base: async (hotelId: string, roomId: string, price: string, expectedVersion: number) =>
    (await apiClient.put(`${path(hotelId, roomId)}/base`, { price, expectedVersion })).data,
};
