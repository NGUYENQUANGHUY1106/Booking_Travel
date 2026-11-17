import { formatCurrency } from './money';

export type AccommodationType = 'HOTEL' | 'RESORT' | 'APARTMENT' | 'VILLA' | 'HOMESTAY' | 'HOSTEL';
export type Amenity = 'Hồ bơi' | 'Wi-Fi miễn phí' | 'Bữa sáng' | 'Bãi đỗ xe' | 'Nhà hàng' | 'Phòng gym' | 'Spa' | 'Điều hòa' | 'Đưa đón sân bay' | 'Lễ tân 24/7' | 'Giặt là' | 'Thang máy' | 'Ban công' | 'Bồn tắm' | 'View biển' | 'Smart TV' | 'Minibar' | 'Két an toàn' | 'Bếp' | 'Máy sấy tóc' | 'Bàn làm việc' | 'Hủy miễn phí';

export interface Hotel {
  id: string;
  name: string;
  address: string;
  destination: string;
  area: string;
  distance: string;
  distanceMeters: number;
  rating: number;
  reviews: number;
  price: number;
  type: AccommodationType;
  amenities: Amenity[];
  image: number;
  description: string;
}

export const DESTINATIONS = [
  { name: 'Đà Nẵng', detail: 'Xem chỗ ở đang mở bán', image: require('./assets/a6086.png') },
  { name: 'Hội An', detail: 'Xem chỗ ở đang mở bán', image: require('./assets/b561a.png') },
] as const;

export const ROOM_IMAGE = require('./assets/9d43f.png');
export const AMENITIES: Amenity[] = ['Hồ bơi', 'Wi-Fi miễn phí', 'Bữa sáng', 'Bãi đỗ xe', 'Nhà hàng', 'Phòng gym', 'Spa', 'Điều hòa', 'Đưa đón sân bay', 'Lễ tân 24/7', 'Giặt là', 'Thang máy'];
export const ROOM_AMENITIES: Amenity[] = ['Ban công', 'Bồn tắm', 'View biển', 'Smart TV', 'Minibar', 'Két an toàn', 'Bếp', 'Máy sấy tóc', 'Bàn làm việc'];
export const ACCOMMODATION_LABELS: Record<AccommodationType, string> = {
  HOTEL: 'Khách sạn', RESORT: 'Resort', APARTMENT: 'Căn hộ', VILLA: 'Villa', HOMESTAY: 'Homestay', HOSTEL: 'Hostel',
};

export function currency(value: number): string {
  return formatCurrency(value);
}

export function dateLabel(value: string): string {
  const [, month, day] = value.split('-').map(Number);
  return `${day} thg ${month}`;
}

export { nights } from './pricing';
