import { useLocalSearchParams } from 'expo-router';

import { TravelerScreenRouter } from '@/features/traveler/TravelerScreenRouter';

export default function UserScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TravelerScreenRouter id={id ?? ''} />;
}
