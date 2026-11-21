import { useLocalSearchParams } from "expo-router";

import { TravelerScreenRouter } from "@/features/traveler/TravelerScreenRouter";

export default function UserScreenRoute() {
  const { id, hotelId, roomId, conversationId, bookingId } = useLocalSearchParams<{
    id: string;
    hotelId?: string;
    roomId?: string;
    conversationId?: string;
    bookingId?: string;
  }>();
  return (
    <TravelerScreenRouter
      conversationId={conversationId}
      bookingId={bookingId}
      hotelId={hotelId}
      id={id ?? ""}
      roomId={roomId}
    />
  );
}
