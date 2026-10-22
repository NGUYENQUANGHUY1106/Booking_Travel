import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { adminUsersApi, type AccountAction, type AdminUserQuery } from "./api";

function retryAdminQuery(failureCount: number, error: unknown) {
  if (
    isAxiosError(error) &&
    [400, 401, 403, 404].includes(error.response?.status ?? 0)
  )
    return false;
  return failureCount < 2;
}

export function useAdminUsers(query: AdminUserQuery) {
  return useQuery({
    queryKey: ["admin-users", query],
    queryFn: () => adminUsersApi.list(query),
    staleTime: 20_000,
    retry: retryAdminQuery,
  });
}

export function useAdminUserDetail(id: string) {
  return useQuery({
    queryKey: ["admin-user-detail", id],
    queryFn: () => adminUsersApi.get(id),
    enabled: !!id,
    retry: retryAdminQuery,
  });
}

export function useAccountAction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      reason,
    }: {
      action: AccountAction;
      reason: string;
    }) => adminUsersApi.changeStatus(id, action, reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-user-detail", id] }),
      ]);
    },
  });
}
