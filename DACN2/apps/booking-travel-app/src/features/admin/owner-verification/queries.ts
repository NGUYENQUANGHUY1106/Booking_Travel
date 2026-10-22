import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { ownerVerificationApi, type OwnerReviewQuery } from './api';

function retry(failureCount: number, error: unknown) {
  if (isAxiosError(error) && [400, 401, 403, 404, 409].includes(error.response?.status ?? 0)) return false;
  return failureCount < 2;
}

export function useOwnerReviewQueue(query: OwnerReviewQuery, enabled = true) {
  return useQuery({
    queryKey: ['owner-verification', 'queue', query],
    queryFn: () => ownerVerificationApi.list(query),
    enabled,
    staleTime: 10_000,
    retry,
  });
}

export function useOwnerReviewDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: ['owner-verification', 'detail', id],
    queryFn: () => ownerVerificationApi.detail(id),
    enabled: enabled && Boolean(id),
    retry,
  });
}

export function useOwnerDecision(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ decision, expectedVersion, reason }: { decision: 'APPROVE' | 'REJECT'; expectedVersion: number; reason?: string }) =>
      ownerVerificationApi.decide(id, decision, expectedVersion, reason),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['owner-verification'] }),
        client.invalidateQueries({ queryKey: ['admin', 'dashboard'] }),
      ]);
    },
  });
}
