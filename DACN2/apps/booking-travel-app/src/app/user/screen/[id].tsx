import { useLocalSearchParams } from "expo-router";

import { TravelerScreenRouter } from "@/features/traveler/TravelerScreenRouter";

export default function UserScreenRoute() {
  const { id, hotelId, roomId, conversationId } = useLocalSearchParams<{
    id: string;
    hotelId?: string;
    roomId?: string;
    conversationId?: string;
  }>();
  return (
    <TravelerScreenRouter
      conversationId={conversationId}
      hotelId={hotelId}
      id={id ?? ""}
      roomId={roomId}
    />
  );
}
