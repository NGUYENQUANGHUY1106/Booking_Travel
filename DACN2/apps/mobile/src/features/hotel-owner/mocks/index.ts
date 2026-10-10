import type { OwnerBooking } from '../types';

export const ownerProfile = {
  name: 'Nguyễn Minh An',
  phone: '0905 123 456',
  hotel: 'Blue Horizon My Khe Hotel',
};

export const hotel = {
  name: 'Blue Horizon My Khe Hotel',
  address: '38 Võ Nguyên Giáp · cách biển 350 m',
  description: 'Gần biển Mỹ Khê · hồ bơi · 26 phòng',
  rating: '9.1/10 · 1.284 đánh giá · Hồ bơi',
  price: 'Từ 1.450.000 ₫ / đêm',
};

export const ownerBooking: OwnerBooking = {
  id: 'BT-2027-DN-00128',
  guest: 'Nguyễn Phan Nhật Quang',
  hotel: hotel.name,
  stay: '12–15/10/2026',
  summary: '3 đêm · 2 khách',
  total: '4.350.000 ₫',
  status: 'Đã xác nhận',
};

export const dashboardKpis = [
  { label: 'DOANH THU THÁNG', value: '48,25 tr ₫', note: '↑ 12% so với tháng trước', tone: 'blue' },
  { label: 'BOOKING MỚI', value: '38', note: '5 booking hôm nay', tone: 'blue' },
  { label: 'TỶ LỆ LẤP ĐẦY', value: '69%', note: 'Mục tiêu tháng 75%', tone: 'green' },
  { label: 'ĐÁNH GIÁ', value: '9.1', note: '1.284 lượt đánh giá', tone: 'green' },
] as const;

export const chartValues = [32, 52, 42, 70, 58, 78, 92];

