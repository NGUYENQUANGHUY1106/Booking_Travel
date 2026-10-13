import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { useTravelerStore } from '@/features/traveler/store';

export default function HotelOwnerLayout() {
  const session = useTravelerStore((state) => state.session);
  const [hydrated, setHydrated] = useState(useTravelerStore.persist.hasHydrated());

  useEffect(() => useTravelerStore.persist.onFinishHydration(() => setHydrated(true)), []);

  if (!hydrated) return null;
  if (session?.role !== 'HOTEL_OWNER') return <Redirect href="/auth/login" />;

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}

