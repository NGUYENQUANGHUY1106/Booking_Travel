import { useQuery } from '@tanstack/react-query';

import { dashboardService, type DashboardScenario } from './service';

export function useAdminDashboard(scenario: DashboardScenario = 'default') {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'demo', scenario],
    queryFn: () => dashboardService.getDashboard(scenario),
    retry: false,
  });
}
