import { ADMIN_DASHBOARD_DEMO } from './mock';
import type { AdminDashboardData } from './types';

export interface DashboardService {
  getDashboard(scenario?: DashboardScenario): Promise<AdminDashboardData>;
}

export type DashboardScenario = 'default' | 'loading' | 'empty' | 'error';

export function parseDashboardScenario(value: unknown): DashboardScenario {
  return value === 'loading' || value === 'empty' || value === 'error' ? value : 'default';
}

let demoErrorPending = true;

export const dashboardService: DashboardService = {
  async getDashboard(scenario = 'default') {
    if (scenario === 'loading') return new Promise<AdminDashboardData>(() => {});
    if (scenario === 'error' && demoErrorPending) {
      demoErrorPending = false;
      throw new Error('Admin dashboard demo error');
    }
    if (scenario === 'empty') return { ...ADMIN_DASHBOARD_DEMO, pendingTasks: [], recentActivities: [] };
    return ADMIN_DASHBOARD_DEMO;
  },
};
