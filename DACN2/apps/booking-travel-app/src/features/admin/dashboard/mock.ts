import type { AdminDashboardData } from './types';

// ADM-UI-02 visual fixture. Amounts and queue counts are illustrative, not platform aggregates.
export const ADMIN_DASHBOARD_DEMO: AdminDashboardData = {
  displayDate: '7 tháng 10, 2026',
  adminDisplayName: 'Nguyễn H. Admin',
  generatedAt: '2026-10-07T09:42:00+07:00',
  kpis: [
    { id: 'revenue', label: 'Doanh thu tháng', displayValue: '48,25 tr', supportingText: '+12% so với tháng trước', tone: 'positive' },
    { id: 'bookings', label: 'Đặt phòng mới', displayValue: '128', supportingText: '+18 trong 7 ngày', tone: 'primary' },
    { id: 'hotels', label: 'KS chờ duyệt', displayValue: '2', supportingText: 'Cần quyết định', tone: 'warning' },
    { id: 'ai', label: 'Cảnh báo AI', displayValue: '1', supportingText: 'Đang cần xem xét', tone: 'warning' },
  ],
  revenueByDay: [
    { day: 'T2', amount: 52 }, { day: 'T3', amount: 74 }, { day: 'T4', amount: 69 },
    { day: 'T5', amount: 100 }, { day: 'T6', amount: 90 }, { day: 'T7', amount: 118, highlighted: true },
    { day: 'CN', amount: 110 },
  ],
  pendingTasks: [
    { id: 'verify-owner', count: 3, label: 'Xác minh chủ khách sạn', destination: 'ownerVerification' },
    { id: 'approve-hotel', count: 2, label: 'Khách sạn chờ duyệt', destination: 'hotelModeration' },
    { id: 'review-flag', count: 1, label: 'Cảnh báo cần xem', destination: 'fraud' },
  ],
  recentActivities: [
    { id: 'hotel-submitted', time: '09:42', description: 'Blue Horizon My Khe Hotel gửi hồ sơ duyệt', status: 'Chờ duyệt', tone: 'primary', destination: 'hotelModeration' },
    { id: 'booking-paid', time: '09:10', description: 'Đặt phòng BT-2027-DN-00128 thanh toán thành công', status: 'Đã xác nhận', tone: 'primary', destination: 'bookings' },
    { id: 'payment-flagged', time: '08:35', description: 'AI gắn cờ giao dịch PAY-2027-DN-00117', status: 'Cần xem', tone: 'warning', destination: 'fraud' },
  ],
};
