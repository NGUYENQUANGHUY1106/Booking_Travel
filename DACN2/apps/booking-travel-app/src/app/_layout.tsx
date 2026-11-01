import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTravelerStore } from '@/features/traveler/store';
import { clearOwnerDashboardCache } from '@/features/hotel-owner/dashboard/model';

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  useEffect(
    () =>
      useTravelerStore.subscribe((state, previous) => {
        const current = state.session;
        const old = previous.session;
        if (
          old?.mode === 'api' &&
          (current?.mode !== 'api' ||
            current.userId !== old.userId ||
            current.sessionId !== old.sessionId ||
            current.role !== old.role)
        ) {
          clearOwnerDashboardCache(queryClient);
          for (const key of [
            'owner-application',
            'owner-application-notifications',
          ]) {
            void queryClient.cancelQueries({ queryKey: [key] });
            queryClient.removeQueries({ queryKey: [key] });
          }
        }
      }),
    [queryClient],
  );
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
