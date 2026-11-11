import { router, type Href } from "expo-router";
import { useState } from "react";

import { useTravelerStore } from "@/features/traveler/store";
import { colors } from "@/features/traveler/theme";
import { Button, T, go } from "@/features/traveler/ui";
import { conversationError, useCreateConversation } from "./api";

export function StartConversationButton({ hotelId }: { hotelId: string }) {
  const session = useTravelerStore((state) => state.session);
  const createConversation = useCreateConversation();
  const [error, setError] = useState("");
  const isTraveler = session?.mode === "api" && session.role === "USER";

  const start = async () => {
    if (!isTraveler) {
      router.push("/auth/login" as Href);
      return;
    }

    setError("");
    try {
      const conversation = await createConversation.mutateAsync(hotelId);
      go("chat-detail", { conversationId: conversation.id, hotelId });
    } catch (cause) {
      setError(
        conversationError(cause, "Không thể tạo cuộc trò chuyện lúc này."),
      );
    }
  };

  return (
    <>
      <Button
        disabled={createConversation.isPending}
        label={
          createConversation.isPending
            ? "Đang mở cuộc trò chuyện..."
            : isTraveler
              ? "Liên hệ khách sạn"
              : "Đăng nhập để trò chuyện"
        }
        onPress={() => void start()}
        secondary
      />
      {error ? (
        <T accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </T>
      ) : null}
    </>
  );
}
