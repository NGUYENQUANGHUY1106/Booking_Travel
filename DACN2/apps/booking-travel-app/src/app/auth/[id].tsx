import { useLocalSearchParams } from 'expo-router';

import { AuthScreen, type AuthScreenId } from '@/features/traveler/AuthScreens';

export default function AuthRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AuthScreen id={(id ?? 'splash') as AuthScreenId} />;
}
