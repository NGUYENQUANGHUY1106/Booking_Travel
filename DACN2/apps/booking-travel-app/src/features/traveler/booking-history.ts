export type BookingHistoryGroup =
  | 'UPCOMING'
  | 'CURRENT'
  | 'COMPLETED'
  | 'CANCELLED';
export type BookingHistoryFilter = 'ALL' | BookingHistoryGroup;

export const BOOKING_HISTORY_FILTERS: {
  key: BookingHistoryFilter;
  label: string;
}[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'UPCOMING', label: 'Sắp tới' },
  { key: 'CURRENT', label: 'Đang lưu trú' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn giữ phòng',
  REFUND_PENDING: 'Đang hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
};

export function bookingStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function bookingHistoryGroup(status: string): BookingHistoryGroup {
  if (status === 'CHECKED_IN') return 'CURRENT';
  if (status === 'COMPLETED') return 'COMPLETED';
  if (status === 'PENDING_PAYMENT' || status === 'CONFIRMED') return 'UPCOMING';
  return 'CANCELLED';
}

export function bookingHistorySections<T extends { status: string }>(
  bookings: T[],
  filter: BookingHistoryFilter,
) {
  const groups = BOOKING_HISTORY_FILTERS.slice(1);
  return groups
    .filter(({ key }) => filter === 'ALL' || filter === key)
    .map(({ key, label }) => ({
      key: key as BookingHistoryGroup,
      label,
      items: bookings.filter((booking) => bookingHistoryGroup(booking.status) === key),
    }))
    .filter(({ items }) => items.length > 0);
}
