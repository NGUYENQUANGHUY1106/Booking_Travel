import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/api-client';
import { useTravelerStore } from '@/features/traveler/store';

export type AdminDashboardSummary = {
  generatedAt: string;
  bookings: { count: number; from: string; to: string; period: 'ROLLING_7_DAYS' };
  activities: { id: string; action: 'SUBMITTED' | 'APPROVED' | 'REJECTED'; hotelName: string; occurredAt: string }[];
};

export function useAdminDashboardSummary() {
  const session = useTravelerStore((state) => state.session);
  const enabled = session?.mode === 'api' && session.role === 'ADMIN';
  return useQuery({
    queryKey: ['admin', 'dashboard', 'summary', enabled ? session.userId : '', enabled ? session.sessionId : ''],
    queryFn: async () => (await apiClient.get<AdminDashboardSummary>('/admin/dashboard/summary')).data,
    enabled,
    staleTime: 5_000,
    refetchOnMount: 'always',
    retry: false,
  });
}
