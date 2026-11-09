import { useLocalSearchParams } from 'expo-router';

import { TravelerScreenRouter } from '@/features/traveler/TravelerScreenRouter';

export default function UserScreenRoute() {
  const { id, hotelId, roomId } = useLocalSearchParams<{ id: string; hotelId?: string; roomId?: string }>();
  return <TravelerScreenRouter hotelId={hotelId} id={id ?? ''} roomId={roomId} />;
}
