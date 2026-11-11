import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router, type Href, useFocusEffect } from "expo-router";

import { useTravelerStore } from "@/features/traveler/store";
import { colors } from "@/features/traveler/theme";
import {
  Card,
  EmptyState,
  T,
  TravelerScaffold,
  go,
} from "@/features/traveler/ui";
import { conversationError, useConversations } from "./api";

function listTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ConversationListScreen() {
  const session = useTravelerStore((state) => state.session);
  const authenticated = session?.mode === "api";
  const conversations = useConversations(authenticated);
  const refetchConversations = conversations.refetch;

  useFocusEffect(
    useCallback(() => {
      if (authenticated) void refetchConversations();
    }, [authenticated, refetchConversations]),
  );

  if (!authenticated) {
    return (
      <TravelerScaffold title="Tin nhắn">
        <EmptyState
          action="Đăng nhập"
          detail="Bạn cần đăng nhập bằng tài khoản thật để xem hội thoại."
          onPress={() => router.push("/auth/login")}
          title="Chưa đăng nhập"
        />
      </TravelerScaffold>
    );
  }
  if (conversations.isPending) {
    return (
      <TravelerScaffold title="Tin nhắn">
        <ActivityIndicator color={colors.primary} />
      </TravelerScaffold>
    );
  }
  if (conversations.isError) {
    return (
      <TravelerScaffold title="Tin nhắn">
        <EmptyState
          action="Thử lại"
          detail={conversationError(
            conversations.error,
            "Không thể tải danh sách hội thoại.",
          )}
          onPress={() => void conversations.refetch()}
          title="Danh sách tin nhắn gặp lỗi"
        />
      </TravelerScaffold>
    );
  }
  if (!conversations.data.length) {
    return (
      <TravelerScaffold title="Tin nhắn">
        <EmptyState
          action={session.role === "USER" ? "Khám phá khách sạn" : undefined}
          detail="Các cuộc trò chuyện của bạn sẽ xuất hiện tại đây."
          onPress={session.role === "USER" ? () => go("results") : undefined}
          title="Chưa có cuộc trò chuyện"
        />
      </TravelerScaffold>
    );
  }

  const openConversation = (conversationId: string) => {
    if (session.role === "HOTEL_OWNER") {
      router.push({
        pathname: "/hotel-owner/screen/[id]",
        params: { id: "chat-detail", conversationId },
      } as Href);
      return;
    }
    go("chat-detail", { conversationId });
  };

  return (
    <TravelerScaffold title="Tin nhắn">
      {conversations.data.map((conversation) => {
        const counterpart =
          session.userId === conversation.ownerId
            ? conversation.user
            : conversation.owner;
        return (
          <Card
            key={conversation.id}
            onPress={() => openConversation(conversation.id)}
          >
            <View style={styles.heading}>
              <View style={styles.titleGroup}>
                <T weight="semibold" style={styles.name}>
                  {counterpart.fullName}
                </T>
                <T style={styles.hotel}>{conversation.hotel.name}</T>
              </View>
              {conversation.unreadCount ? (
                <View style={styles.badge}>
                  <T weight="semibold" style={styles.badgeText}>
                    {conversation.unreadCount > 99
                      ? "99+"
                      : conversation.unreadCount}
                  </T>
                </View>
              ) : null}
            </View>
            <View style={styles.previewRow}>
              <T
                numberOfLines={1}
                style={[
                  styles.preview,
                  conversation.unreadCount ? styles.unread : undefined,
                ]}
              >
                {conversation.lastMessage?.content ?? "Chưa có tin nhắn"}
              </T>
              <T style={styles.time}>
                {listTime(
                  conversation.lastMessage?.createdAt ?? conversation.updatedAt,
                )}
              </T>
            </View>
          </Card>
        );
      })}
    </TravelerScaffold>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleGroup: { flex: 1, gap: 2 },
  name: { fontSize: 16 },
  hotel: { color: colors.muted, fontSize: 12 },
  badge: {
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.white, fontSize: 12 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  preview: { flex: 1, color: colors.muted, fontSize: 13 },
  unread: { color: colors.ink },
  time: { color: colors.muted, fontSize: 11 },
});
