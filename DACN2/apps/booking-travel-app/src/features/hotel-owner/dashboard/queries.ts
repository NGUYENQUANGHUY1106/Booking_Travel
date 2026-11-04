import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@/services/api-client';
import {
  dashboardKey,
  OWNER_DASHBOARD_KEY,
  type DashboardFilter,
  type DashboardHotel,
  type OwnerDashboard,
} from './model';

export function responseStatus(error: unknown) {
  return isAxiosError(error) ? error.response?.status : undefined;
}

const retry = (attempt: number, error: unknown) =>
  ![400, 401, 403, 404].includes(responseStatus(error) ?? 0) && attempt < 1;

export function useOwnerDashboard(
  userId: string,
  sessionId: string,
  filter: DashboardFilter,
  enabled: boolean,
) {
  return useQuery({
    queryKey: dashboardKey(userId, sessionId, filter),
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<OwnerDashboard>('/owner/dashboard', {
          params: filter,
          signal,
        })
      ).data,
    enabled,
    staleTime: 15_000,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
    retry,
  });
}

export function useDashboardHotels(
  userId: string,
  sessionId: string,
  enabled: boolean,
) {
  return useInfiniteQuery({
    queryKey: [OWNER_DASHBOARD_KEY, userId, sessionId, 'HOTEL_OWNER', 'hotels'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, pageParam }) =>
      (
        await apiClient.get<{
          items: DashboardHotel[];
          nextCursor: string | null;
        }>('/owner/dashboard/hotels', {
          params: { after: pageParam, limit: 30 },
          signal,
        })
      ).data,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
    staleTime: 15_000,
    refetchOnMount: 'always',
    retry,
  });
}
