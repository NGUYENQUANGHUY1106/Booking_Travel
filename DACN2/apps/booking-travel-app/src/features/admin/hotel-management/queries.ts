import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTravelerStore } from '@/features/traveler/store';
import { managedHotelApi, type ManagedHotelQuery } from './api';

const key = ['admin', 'hotel-management'] as const;
function useIdentity() {
  const session = useTravelerStore((state) => state.session);
  return { enabled: session?.mode === 'api' && session.role === 'ADMIN', identity: [session?.mode === 'api' ? session.userId : '', session?.mode === 'api' ? session.sessionId : ''] };
}
export function useManagedHotels(query: ManagedHotelQuery) {
  const { enabled, identity } = useIdentity();
  return useQuery({ queryKey: [...key, ...identity, 'list', query], queryFn: () => managedHotelApi.list(query), enabled, staleTime: 5_000, refetchOnMount: 'always' });
}
export function useManagedHotel(id: string) {
  const { enabled, identity } = useIdentity();
  return useQuery({ queryKey: [...key, ...identity, 'detail', id], queryFn: () => managedHotelApi.detail(id), enabled: enabled && Boolean(id), staleTime: 5_000, retry: false });
}
export function useInvalidateManagedHotels() {
  const client = useQueryClient();
  return async () => Promise.all([
    client.invalidateQueries({ queryKey: key }),
    client.invalidateQueries({ queryKey: ['hotels'] }),
    client.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
  ]);
}
