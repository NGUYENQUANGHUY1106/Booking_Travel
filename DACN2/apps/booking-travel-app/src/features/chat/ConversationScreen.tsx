import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useTravelerStore } from "@/features/traveler/store";
import { colors } from "@/features/traveler/theme";
import {
  Card,
  EmptyState,
  T,
  TravelerScaffold,
  go,
} from "@/features/traveler/ui";
import {
  type ChatMessage,
  conversationError,
  useConversation,
  useConversationMessages,
} from "./api";
import { useConversationRealtime } from "./realtime";

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function messageTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ConversationScreen({
  conversationId,
}: {
  conversationId?: string;
}) {
  const session = useTravelerStore((state) => state.session);
  const conversation = useConversation(conversationId);
  const history = useConversationMessages(conversationId);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const receiveMessage = useCallback((message: ChatMessage) => {
    setLiveMessages((current) => mergeMessages(current, [message]));
  }, []);
  const realtime = useConversationRealtime(conversationId, receiveMessage);
  const messages = mergeMessages(
    history.data ?? [],
    liveMessages.filter(
      (message) => message.conversationId === conversationId,
    ),
  );

  if (!conversationId) {
    return (
      <TravelerScaffold title="Cuộc trò chuyện" back>
        <EmptyState
          detail="Hãy mở hội thoại từ danh sách tin nhắn."
          title="Chưa chọn cuộc trò chuyện"
        />
      </TravelerScaffold>
    );
  }
  if (conversation.isPending) {
    return (
      <TravelerScaffold title="Cuộc trò chuyện" back>
        <ActivityIndicator color={colors.primary} />
      </TravelerScaffold>
    );
  }
  if (conversation.isError || !conversation.data) {
    return (
      <TravelerScaffold title="Cuộc trò chuyện" back>
        <EmptyState
          action="Thử lại"
          detail={conversationError(
            conversation.error,
            "Không thể tải cuộc trò chuyện.",
          )}
          onPress={() => void conversation.refetch()}
          title="Không mở được cuộc trò chuyện"
        />
      </TravelerScaffold>
    );
  }

  const data = conversation.data;
  const currentUserId = session?.mode === "api" ? session.userId : undefined;
  const counterpart =
    currentUserId === data.ownerId ? data.user.fullName : data.owner.fullName;
  const submit = async () => {
    const sent = await realtime.send(draft);
    if (sent) setDraft("");
  };

  return (
    <TravelerScaffold title={`Trò chuyện với ${counterpart}`} back>
      <Card>
        <T weight="semibold">{data.hotel.name}</T>
        <T style={{ color: colors.muted }}>
          {realtime.connected
            ? "● Đang kết nối realtime"
            : "○ Đang kết nối lại"}
        </T>
      </Card>

      {history.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : history.isError ? (
        <EmptyState
          action="Thử lại"
          detail={conversationError(
            history.error,
            "Không thể tải lịch sử tin nhắn.",
          )}
          onPress={() => void history.refetch()}
          title="Lịch sử tin nhắn gặp lỗi"
        />
      ) : messages.length ? (
        <View style={styles.messages}>
          {messages.map((message) => {
            const mine = message.senderId === currentUserId;
            return (
              <View
                key={message.id}
                style={[
                  styles.messageRow,
                  mine ? styles.messageRowMine : styles.messageRowOther,
                ]}
              >
                <View
                  style={[
                    styles.bubble,
                    mine ? styles.bubbleMine : styles.bubbleOther,
                  ]}
                >
                  {!mine ? (
                    <T weight="semibold" style={styles.sender}>
                      {message.sender.fullName}
                    </T>
                  ) : null}
                  <T style={mine ? styles.mineText : undefined}>
                    {message.content}
                  </T>
                  <T style={[styles.time, mine ? styles.mineTime : undefined]}>
                    {messageTime(message.createdAt)}
                  </T>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Card>
          <T weight="semibold">Chưa có tin nhắn</T>
          <T style={{ color: colors.muted }}>
            Hãy gửi lời chào để bắt đầu cuộc trò chuyện.
          </T>
        </Card>
      )}

      {realtime.error ? <T style={styles.error}>{realtime.error}</T> : null}
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Nội dung tin nhắn"
          editable={!realtime.sending}
          maxLength={2000}
          multiline
          onChangeText={setDraft}
          placeholder="Nhập tin nhắn..."
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={draft}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: !realtime.connected || realtime.sending || !draft.trim(),
          }}
          disabled={!realtime.connected || realtime.sending || !draft.trim()}
          onPress={() => void submit()}
          style={({ pressed }) => [
            styles.sendButton,
            (!realtime.connected || realtime.sending || !draft.trim()) &&
              styles.sendDisabled,
            pressed && styles.sendPressed,
          ]}
        >
          <T weight="semibold" style={styles.sendText}>
            {realtime.sending ? "Đang gửi" : "Gửi"}
          </T>
        </Pressable>
      </View>
      {currentUserId === data.userId ? (
        <Pressable
          onPress={() => go("hotel-detail", { hotelId: data.hotelId })}
        >
          <T weight="semibold" style={styles.hotelLink}>
            Xem lại khách sạn
          </T>
        </Pressable>
      ) : null}
    </TravelerScaffold>
  );
}

const styles = StyleSheet.create({
  messages: { gap: 10 },
  messageRow: { width: "100%", flexDirection: "row" },
  messageRowMine: { justifyContent: "flex-end" },
  messageRowOther: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: 16, padding: 12, gap: 4 },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleOther: { backgroundColor: colors.white },
  mineText: { color: colors.white },
  sender: { color: colors.primaryDark, fontSize: 12 },
  time: { color: colors.muted, fontSize: 11, textAlign: "right" },
  mineTime: { color: "#DBEAFE" },
  error: { color: colors.error, fontSize: 13 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.white,
    color: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendButton: {
    minWidth: 68,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
  },
  sendDisabled: { opacity: 0.45 },
  sendPressed: { opacity: 0.75 },
  sendText: { color: colors.white },
  hotelLink: { color: colors.primaryDark, textAlign: "center" },
});
