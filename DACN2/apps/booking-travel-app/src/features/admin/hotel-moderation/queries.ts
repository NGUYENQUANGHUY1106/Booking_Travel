import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTravelerStore } from '@/features/traveler/store';
import { hotelReviewApi, type HotelReviewQuery } from './api';

export const HOTEL_REVIEW_KEY = ['admin', 'hotel-submissions'] as const;

export function useHotelReviewQueue(query: HotelReviewQuery) {
  const session = useTravelerStore((state) => state.session);
  const enabled = session?.mode === 'api' && session.role === 'ADMIN';
  return useQuery({
    queryKey: [...HOTEL_REVIEW_KEY, session?.mode === 'api' ? session.userId : '', session?.mode === 'api' ? session.sessionId : '', 'queue', query],
    queryFn: () => hotelReviewApi.list(query),
    enabled,
    staleTime: 5_000,
    refetchOnMount: 'always',
  });
}

export function useHotelReviewDetail(id: string) {
  const session = useTravelerStore((state) => state.session);
  const enabled = session?.mode === 'api' && session.role === 'ADMIN';
  return useQuery({
    queryKey: [...HOTEL_REVIEW_KEY, session?.mode === 'api' ? session.userId : '', session?.mode === 'api' ? session.sessionId : '', 'detail', id],
    queryFn: () => hotelReviewApi.detail(id),
    enabled: enabled && Boolean(id),
    staleTime: 5_000,
    retry: false,
  });
}

export function useInvalidateHotelReview() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: HOTEL_REVIEW_KEY }),
      client.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
    ]);
  };
}
