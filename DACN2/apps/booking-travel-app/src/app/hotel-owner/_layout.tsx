import { Redirect, Stack, usePathname, type Href } from 'expo-router';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';

import { OwnerButton, OwnerScaffold } from '@/features/hotel-owner/components';
import { ownerColors } from '@/features/hotel-owner/styles/tokens';
import { useOwnerCurrent } from '@/features/owner-application/api';
import { useTravelerStore } from '@/features/traveler/store';
import { responseStatus } from '@/features/hotel-owner/dashboard/queries';
import { clearOwnerDashboardCache } from '@/features/hotel-owner/dashboard/model';

export default function HotelOwnerLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const pathname = usePathname();
  const client = useQueryClient();
  const session = useTravelerStore((state) => state.session);
  const userId =
    session?.mode === 'api' && session.role === 'HOTEL_OWNER'
      ? session.userId
      : undefined;
  const verification = useOwnerCurrent(userId);
  const refetchVerification = verification.refetch;
  const [hydrated, setHydrated] = useState(
    useTravelerStore.persist.hasHydrated(),
  );
  const denied =
    [401, 403].includes(responseStatus(verification.error) ?? 0) ||
    Boolean(verification.data && !verification.data.ownerEntitlementActive);
  useEffect(() => {
    if (denied) clearOwnerDashboardCache(client);
  }, [denied, client]);

  useEffect(
    () => useTravelerStore.persist.onFinishHydration(() => setHydrated(true)),
    [],
  );
  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refetchVerification();
    });
    return () => subscription.remove();
  }, [userId, refetchVerification]);

  if (!hydrated || (!fontsLoaded && !fontError)) return null;
  if (!session) return <Redirect href="/auth/login" />;
  if (session.role !== 'HOTEL_OWNER')
    return <Redirect href={'/owner-application/status' as Href} />;
  if (session.mode === 'api') {
    if (denied)
      return (
        <Redirect
          href={
            (responseStatus(verification.error) === 401
              ? '/auth/login'
              : '/owner-application/status') as Href
          }
        />
      );
    if (verification.isPending && verification.fetchStatus !== 'paused')
      return (
        <OwnerScaffold title="Đang kiểm tra quyền">
          <ActivityIndicator color={ownerColors.primary} />
        </OwnerScaffold>
      );
    const cachedDashboard =
      pathname === '/hotel-owner' &&
      verification.data?.ownerEntitlementActive &&
      !responseStatus(verification.error);
    if (
      (verification.isError || verification.fetchStatus === 'paused') &&
      !cachedDashboard
    )
      return (
        <OwnerScaffold title="Không thể kiểm tra quyền">
          <View style={{ gap: 12 }}>
            <Text>Vui lòng kết nối mạng để xác nhận quyền Chủ khách sạn.</Text>
            <OwnerButton
              label="Thử lại"
              onPress={() => void verification.refetch()}
            />
          </View>
        </OwnerScaffold>
      );
    if (!verification.data?.ownerEntitlementActive) {
      return <Redirect href={'/owner-application/status' as Href} />;
    }
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    />
  );
}
