import { useLocalSearchParams } from 'expo-router';

import { AuthScreen, type AuthScreenId } from '@/features/traveler/AuthScreens';

export default function AuthRoute() {
  const { id, verificationSessionId, resetSessionId, email } = useLocalSearchParams<{
    id: string;
    verificationSessionId?: string;
    resetSessionId?: string;
    email?: string;
  }>();

  return (
    <AuthScreen
      id={(id ?? 'splash') as AuthScreenId}
      resetSessionId={resetSessionId}
      verificationEmail={email}
      verificationSessionId={verificationSessionId}
    />
  );
}
