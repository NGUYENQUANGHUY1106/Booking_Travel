import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';

import { OwnerButton, OwnerScaffold } from '@/features/hotel-owner/components';
import { ownerColors } from '@/features/hotel-owner/styles/tokens';
import { useOwnerCurrent } from '@/features/owner-application/api';
import { useTravelerStore } from '@/features/traveler/store';

export default function HotelOwnerLayout() {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const verification = useOwnerCurrent(userId);
  const refetchVerification = verification.refetch;
  const [hydrated, setHydrated] = useState(useTravelerStore.persist.hasHydrated());

  useEffect(() => useTravelerStore.persist.onFinishHydration(() => setHydrated(true)), []);
  useEffect(() => {
    if (!userId) return;
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refetchVerification(); });
    return () => subscription.remove();
  }, [userId, refetchVerification]);

  if (!hydrated) return null;
  if (!session) return <Redirect href="/auth/login" />;
  if (session.role !== 'HOTEL_OWNER') return <Redirect href="/owner-application/status" />;
  if (session.mode === 'api') {
    if (verification.isPending || verification.isFetching) return <OwnerScaffold title="Đang kiểm tra quyền"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
    if (verification.isError) return <OwnerScaffold title="Không thể kiểm tra quyền"><View style={{ gap: 12 }}><Text>Vui lòng kết nối mạng để xác nhận quyền Chủ khách sạn.</Text><OwnerButton label="Thử lại" onPress={() => void verification.refetch()} /></View></OwnerScaffold>;
    if (!verification.data?.ownerEntitlementActive) return <Redirect href="/owner-application/status" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}

