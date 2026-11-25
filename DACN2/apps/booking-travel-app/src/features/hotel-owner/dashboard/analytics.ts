import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { calendarDate, DASHBOARD_TIME_ZONE, OWNER_DASHBOARD_KEY } from './model';

export type AnalyticsGranularity = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
export type AnalyticsFilter = {
  hotelId?: string;
  roomId?: string;
  dateFrom: string;
  dateTo: string;
  granularity: AnalyticsGranularity;
  timeZone: typeof DASHBOARD_TIME_ZONE;
};
export type AnalyticsMetrics = {
  bookedValue: number;
  collected: number;
  refunded: number;
  netCollected: number;
  soldRoomNights: number;
  sellableRoomNights: number;
  occupancyPercent: number | null;
  adr: number | null;
  bookingCount: number;
  cancelledCount: number;
  cancellationPercent: number | null;
};
export type OwnerAnalytics = {
  version: string;
  currency: 'VND';
  asOf: string;
  sourceFreshness: { payments: string; inventory: string; rating: string };
  scope: AnalyticsFilter & { hotelName: string | null };
  roomOptions: { id: string; name: string }[];
  summary: AnalyticsMetrics;
  points: ({ label: string; bucketStart: string; bucketEndExclusive: string } & AnalyticsMetrics)[];
  rooms: ({ id: string; name: string } & AnalyticsMetrics)[];
  rating: { score: null; count: null; reason: string };
  limitations: string[];
};

export function analyticsPeriod(granularity: AnalyticsGranularity, now = new Date()): AnalyticsFilter {
  const dateTo = calendarDate(now);
  const date = new Date(`${dateTo}T00:00:00Z`);
  if (granularity === 'WEEK') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (granularity === 'MONTH') date.setUTCDate(1);
  if (granularity === 'YEAR') { date.setUTCMonth(0); date.setUTCDate(1); }
  return { dateFrom: date.toISOString().slice(0, 10), dateTo, granularity, timeZone: DASHBOARD_TIME_ZONE };
}

export function useOwnerAnalytics(userId: string, sessionId: string, filter: AnalyticsFilter, enabled: boolean) {
  return useQuery({
    queryKey: [OWNER_DASHBOARD_KEY, userId, sessionId, 'HOTEL_OWNER', 'analytics', filter.hotelId ?? 'all', filter.roomId ?? 'all', filter.dateFrom, filter.dateTo, filter.granularity, filter.timeZone],
    queryFn: async ({ signal }) => (await apiClient.get<OwnerAnalytics>('/owner/analytics', { params: filter, signal })).data,
    enabled,
    staleTime: 15_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });
}

export const money = (value: number | null) => value === null ? 'Chưa đủ dữ liệu' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)} ₫`;
export const percent = (value: number | null) => value === null ? 'Chưa đủ dữ liệu' : `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value)}%`;
