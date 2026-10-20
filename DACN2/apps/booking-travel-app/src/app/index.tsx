import { Redirect, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useTravelerStore } from '@/features/traveler/store';
import { colors } from '@/features/traveler/theme';
import { T } from '@/features/traveler/ui';

export default function Index() {
  const session = useTravelerStore((state) => state.session);
  const [hydrated, setHydrated] = useState(useTravelerStore.persist.hasHydrated());
  useEffect(() => useTravelerStore.persist.onFinishHydration(() => setHydrated(true)), []);
  if (!hydrated) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white }}><T weight="semibold">Booking Travel</T></View>;
  if (!session) return <Redirect href="/auth/splash" />;

  if (session.role === 'ADMIN') return <Redirect href={'/admin' as Href} />;
  return <Redirect href={session.role === 'HOTEL_OWNER' ? '/hotel-owner' : '/user'} />;
}
