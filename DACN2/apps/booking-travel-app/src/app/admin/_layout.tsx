import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';

import { canOpenAdminDashboard, isAdminDemoEnabled } from '@/features/admin/session';
import { useTravelerStore } from '@/features/traveler/store';

export default function AdminLayout() {
  const session = useTravelerStore((state) => state.session);
  const [hydrated, setHydrated] = useState(useTravelerStore.persist.hasHydrated());
  const [fontsLoaded, fontsError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => useTravelerStore.persist.onFinishHydration(() => setHydrated(true)), []);

  if (!hydrated || (!fontsLoaded && !fontsError)) return null;
  if (!canOpenAdminDashboard(session?.role, isAdminDemoEnabled(process.env.EXPO_PUBLIC_ENABLE_ADMIN_DEMO))) return <Redirect href="/auth/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
