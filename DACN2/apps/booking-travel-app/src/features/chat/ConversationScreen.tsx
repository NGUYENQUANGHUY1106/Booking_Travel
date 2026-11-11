import { ActivityIndicator } from "react-native";

import { colors } from "@/features/traveler/theme";
import {
  Button,
  Card,
  EmptyState,
  T,
  TravelerScaffold,
  go,
} from "@/features/traveler/ui";
import { conversationError, useConversation } from "./api";

export function ConversationScreen({
  conversationId,
}: {
  conversationId?: string;
}) {
  const conversation = useConversation(conversationId);

  if (!conversationId) {
    return (
      <TravelerScaffold title="Cuộc trò chuyện" back>
        <EmptyState
          action="Tìm khách sạn"
          detail="Hãy mở một khách sạn và chọn Liên hệ khách sạn."
          onPress={() => go("results")}
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
  return (
    <TravelerScaffold title="Trò chuyện với khách sạn" back>
      <Card>
        <T weight="semibold">{data.hotel.name}</T>
        <T style={{ color: colors.muted }}>
          Chủ khách sạn: {data.owner.fullName}
        </T>
      </Card>
      <Card>
        <T weight="semibold">Cuộc trò chuyện đã sẵn sàng</T>
        <T style={{ color: colors.muted }}>
          Bạn đã kết nối với Chủ khách sạn. Chức năng gửi tin nhắn sẽ được triển
          khai trong ST-COM-02.
        </T>
      </Card>
      <Button
        label="Xem lại khách sạn"
        onPress={() => go("hotel-detail", { hotelId: data.hotelId })}
        secondary
      />
    </TravelerScaffold>
  );
}
