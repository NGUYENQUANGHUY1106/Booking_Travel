import { useQuery } from '@tanstack/react-query';

import { dashboardService, type DashboardScenario } from './service';

export function useAdminDashboard(scenario: DashboardScenario = 'default', enabled = true) {
  return useQuery({
    queryKey: ['admin', 'dashboard', 'demo', scenario],
    queryFn: () => dashboardService.getDashboard(scenario),
    enabled,
    retry: false,
  });
}
