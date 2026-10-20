export type DashboardKpi = {
  id: string;
  label: string;
  displayValue: string;
  supportingText: string;
  tone: 'positive' | 'primary' | 'warning' | 'neutral';
};

export type DailyRevenue = {
  day: string;
  amount: number;
  highlighted?: boolean;
};

export type AdminDestination =
  | 'users' | 'ownerVerification' | 'hotelModeration' | 'bookings'
  | 'payments' | 'reviews' | 'promotions' | 'analytics' | 'fraud' | 'audit';

export type PendingTask = {
  id: string;
  count: number;
  label: string;
  destination: AdminDestination;
};

export type RecentActivity = {
  id: string;
  time: string;
  description: string;
  status: string;
  tone: 'primary' | 'warning';
  destination: AdminDestination;
};

export type AdminDashboardData = {
  kpis: DashboardKpi[];
  revenueByDay: DailyRevenue[];
  pendingTasks: PendingTask[];
  recentActivities: RecentActivity[];
  generatedAt?: string;
  displayDate: string;
  adminDisplayName: string;
};
