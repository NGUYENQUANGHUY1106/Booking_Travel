import type { MockSessionRole } from '@/features/traveler/store';

export const ADMIN_DEMO_EMAIL = 'admin@bookingtravel.vn';
export const ADMIN_DEMO_PASSWORD = 'admin123';

export const mockAdminAuthService = {
  async signIn(email: string, password: string) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return email.trim().toLowerCase() === ADMIN_DEMO_EMAIL && password === ADMIN_DEMO_PASSWORD
      ? { email: ADMIN_DEMO_EMAIL, role: 'ADMIN' as const }
      : null;
  },
};

export function isAdminDemoEnabled(flag: string | undefined) {
  return flag === 'true';
}

export function canOpenAdminDashboard(role: MockSessionRole | undefined, demoEnabled: boolean, mode?: 'api' | 'mock') {
  return role === 'ADMIN' && (mode === 'api' || demoEnabled);
}
