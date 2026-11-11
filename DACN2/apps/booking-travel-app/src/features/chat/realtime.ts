import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { refreshApiSession, useTravelerStore } from "@/features/traveler/store";
import { resolveApiBaseUrl } from "@/services/api-client";
import type { ChatMessage } from "./api";

type SocketAck =
  { ok: true; message?: ChatMessage } | { ok: false; error: string };

const DEFAULT_SOCKET_URL = "http://localhost:3000";

function socketUrl() {
  const configured = process.env.EXPO_PUBLIC_SOCKET_URL ?? DEFAULT_SOCKET_URL;
  return resolveApiBaseUrl(configured).replace(/\/api\/?$/, "");
}

export function useConversationRealtime(
  conversationId: string | undefined,
  onMessage: (message: ChatMessage) => void,
) {
  const session = useTravelerStore((state) => state.session);
  const accessToken = session?.mode === "api" ? session.accessToken : undefined;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!conversationId || !accessToken) return;

    const socket = io(`${socketUrl()}/chat`, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });
    socketRef.current = socket;
    let refreshing = false;

    const join = async () => {
      setConnected(true);
      setError("");
      try {
        const response = (await socket
          .timeout(10_000)
          .emitWithAck("conversation:join", { conversationId })) as SocketAck;
        if (!response.ok) throw new Error(response.error);
        setJoined(true);
      } catch (joinError) {
        setError(
          joinError instanceof Error
            ? joinError.message
            : "Không thể tham gia cuộc trò chuyện.",
        );
      }
    };
    const disconnect = () => {
      setConnected(false);
      setJoined(false);
    };
    const connectionError = async (connectionIssue: Error) => {
      disconnect();
      if (
        refreshing ||
        !connectionIssue.message.toLowerCase().includes("access token")
      ) {
        setError(connectionIssue.message);
        return;
      }
      refreshing = true;
      const refreshedToken = await refreshApiSession();
      refreshing = false;
      if (!refreshedToken) {
        setError("Phiên đăng nhập đã hết hạn.");
        return;
      }
      socket.auth = { token: refreshedToken };
      socket.connect();
    };
    const socketError = (payload: { message?: string } | string) => {
      setError(
        typeof payload === "string"
          ? payload
          : payload.message || "Kết nối chat gặp lỗi.",
      );
    };

    socket.on("connect", join);
    socket.on("disconnect", disconnect);
    socket.on("connect_error", connectionError);
    socket.on("exception", socketError);
    socket.on("message:new", onMessage);

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setJoined(false);
    };
  }, [accessToken, conversationId, onMessage]);

  const send = useCallback(
    async (content: string) => {
      const socket = socketRef.current;
      const normalizedContent = content.trim();
      if (!socket || !joined || !normalizedContent) return undefined;

      setSending(true);
      setError("");
      try {
        const response = (await socket
          .timeout(10_000)
          .emitWithAck("message:send", {
            conversationId,
            content: normalizedContent,
          })) as SocketAck;
        if (!response.ok) throw new Error(response.error);
        if (response.message) onMessage(response.message);
        return response.message;
      } catch (sendError) {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Không thể gửi tin nhắn.",
        );
        return undefined;
      } finally {
        setSending(false);
      }
    },
    [conversationId, joined, onMessage],
  );

  return { connected: connected && joined, sending, error, send };
}
