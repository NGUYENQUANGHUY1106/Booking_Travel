import { useLocalSearchParams } from 'expo-router';

import { TravelerScreenRouter } from '@/features/traveler/TravelerScreenRouter';

export default function UserScreenRoute() {
  const { id, hotelId } = useLocalSearchParams<{ id: string; hotelId?: string }>();
  return <TravelerScreenRouter hotelId={hotelId} id={id ?? ''} />;
}
