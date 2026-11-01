import type { QueryClient } from '@tanstack/react-query';

export const OWNER_DASHBOARD_KEY = 'owner-dashboard';
export const DASHBOARD_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function clearOwnerDashboardCache(client: QueryClient) {
  void client.cancelQueries({ queryKey: [OWNER_DASHBOARD_KEY] });
  client.removeQueries({ queryKey: [OWNER_DASHBOARD_KEY] });
}

export type DashboardFilter = {
  hotelId?: string;
  dateFrom: string;
  dateTo: string;
  timeZone: string;
};
export type DashboardHotel = {
  id: string;
  name: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
};
type Unavailable = { availability: 'unavailable'; reason: string };
export type OwnerDashboard = {
  scope: DashboardFilter & {
    hotel: DashboardHotel | null;
    hotelCount: number;
    today: string;
    previousFrom: string;
    previousTo: string;
  };
  updatedAt: string;
  summary: {
    hotelCount: number;
    roomCount: number;
    upcomingBookings: number;
    currentGuests: number;
  };
  bookings: {
    availability: 'available';
    basis: 'createdAt';
    count: number;
    previousCount: number;
    difference: number;
  };
  occupancy: Unavailable & {
    percentage: null;
    soldRoomNights: null;
    sellableRoomNights: null;
  };
  revenue: Unavailable & { amount: null; currency: null; comparison: null };
  revenueSeries: Unavailable & { points: null };
  rating: Unavailable & { score: null; count: null };
  actions: {
    date: string;
    arrivals: number;
    departures: number;
    support: Unavailable;
  };
  ai: Unavailable;
};

export function calendarDate(now: Date, timeZone = DASHBOARD_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}-${parts.find((p) => p.type === 'day')!.value}`;
}

export function validDateRange(from: string, to: string) {
  const valid = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
      return false;
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  };
  if (!valid(from) || !valid(to) || from > to) return false;
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return new Date(start - (end - start + 86_400_000)).getUTCFullYear() >= 1;
}

export function dashboardKey(
  userId: string,
  sessionId: string,
  filter: DashboardFilter,
) {
  return [
    OWNER_DASHBOARD_KEY,
    userId,
    sessionId,
    'HOTEL_OWNER',
    'metrics',
    filter.hotelId ?? 'all',
    filter.dateFrom,
    filter.dateTo,
    filter.timeZone,
  ] as const;
}

export function formatDashboardDate(value: string) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('vi-VN', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export const HOTEL_STATUS_LABEL: Record<DashboardHotel['status'], string> = {
  DRAFT: 'Bản nháp',
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Cần chỉnh sửa',
  SUSPENDED: 'Đình chỉ',
};
