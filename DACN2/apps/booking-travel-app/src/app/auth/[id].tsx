import { useLocalSearchParams } from 'expo-router';

import { AuthScreen, type AuthScreenId } from '@/features/traveler/AuthScreens';

export default function AuthRoute() {
  const { id, verificationSessionId, email } = useLocalSearchParams<{
    id: string;
    verificationSessionId?: string;
    email?: string;
  }>();

  return <AuthScreen id={(id ?? 'splash') as AuthScreenId} verificationEmail={email} verificationSessionId={verificationSessionId} />;
}
