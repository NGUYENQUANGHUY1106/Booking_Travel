import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
};

export const notificationsKey = (userId: string) =>
  ["notifications", userId] as const;

export function useNotifications(userId?: string) {
  return useQuery({
    queryKey: notificationsKey(userId ?? ""),
    queryFn: async () =>
      (await apiClient.get<AppNotification[]>("/notifications")).data,
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchOnMount: "always",
    refetchOnReconnect: true,
  });
}

export function useUnreadNotificationCount(userId?: string) {
  return useQuery({
    queryKey: ["notifications-unread-count", userId ?? ""],
    queryFn: async () =>
      (await apiClient.get<{ count: number }>("/notifications/unread-count"))
        .data,
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchOnMount: "always",
  });
}

export function useReadNotification(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) =>
      (
        await apiClient.patch<AppNotification>(
          `/notifications/${notificationId}/read`,
        )
      ).data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: notificationsKey(userId ?? ""),
        }),
        queryClient.invalidateQueries({
          queryKey: ["notifications-unread-count", userId ?? ""],
        }),
      ]);
    },
  });
}
