import { useMutation, useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { apiClient } from "@/services/api-client";

export type Conversation = {
  id: string;
  userId: string;
  ownerId: string;
  hotelId: string;
  createdAt: string;
  updatedAt: string;
  hotel: { id: string; name: string; coverImageUrl: string | null };
  user: { id: string; fullName: string; avatarUrl: string | null };
  owner: { id: string; fullName: string; avatarUrl: string | null };
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; fullName: string; avatarUrl: string | null };
};

export function useCreateConversation() {
  return useMutation({
    mutationFn: async (hotelId: string) =>
      (await apiClient.post<Conversation>("/conversations", { hotelId })).data,
  });
}

export function useConversation(id?: string) {
  return useQuery({
    queryKey: ["conversation", id],
    queryFn: async () =>
      (await apiClient.get<Conversation>(`/conversations/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useConversationMessages(id?: string) {
  return useQuery({
    queryKey: ["conversation", id, "messages"],
    queryFn: async () =>
      (await apiClient.get<ChatMessage[]>(`/conversations/${id}/messages`))
        .data,
    enabled: Boolean(id),
  });
}

export function conversationError(error: unknown, fallback: string) {
  if (!isAxiosError<{ message?: string | string[] }>(error)) return fallback;
  const message = error.response?.data?.message;
  return Array.isArray(message) ? message.join("\n") : message || fallback;
}
