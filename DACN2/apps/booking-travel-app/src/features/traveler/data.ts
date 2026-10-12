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

export const HOTELS: Hotel[] = [
  {
    id: 'blue-horizon', name: 'Blue Horizon My Khe Hotel', address: '38 Võ Nguyên Giáp', destination: 'Đà Nẵng', area: 'Mỹ Khê', distance: 'cách biển 350 m', distanceMeters: 350,
    rating: 9.1, reviews: 1284, price: 1450000, type: 'HOTEL',
    amenities: ['Hồ bơi', 'Wi-Fi miễn phí', 'Bữa sáng', 'View biển', 'Hủy miễn phí', 'Nhà hàng', 'Điều hòa', 'Ban công', 'Bồn tắm', 'Smart TV', 'Minibar', 'Máy sấy tóc'],
    image: require('./assets/a83c5.png'),
    description: 'Không gian nghỉ dưỡng ấm áp tại Mỹ Khê, thuận tiện khám phá Sơn Trà và trung tâm Đà Nẵng. Tận hưởng hồ bơi nhìn ra biển và các phòng rộng rãi.',
  },
  {
    id: 'an-thu', name: 'An Thu Riverside Boutique', address: '12 Nguyễn Phúc Chu', destination: 'Hội An', area: 'Phố cổ', distance: 'gần phố cổ', distanceMeters: 250,
    rating: 9.3, reviews: 864, price: 1190000, type: 'HOTEL',
    amenities: ['Wi-Fi miễn phí', 'Bữa sáng', 'Nhà hàng', 'Hủy miễn phí', 'Điều hòa', 'Bàn làm việc'],
    image: require('./assets/b561a.png'),
    description: 'Khách sạn boutique bên sông, thuận tiện khám phá phố cổ Hội An và tận hưởng không gian yên bình.',
  },
  {
    id: 'seabreeze', name: 'Seabreeze Da Nang Hotel', address: '88 Võ Nguyên Giáp', destination: 'Đà Nẵng', area: 'Mỹ Khê', distance: 'gần biển', distanceMeters: 180,
    rating: 8.9, reviews: 746, price: 1190000, type: 'HOTEL',
    amenities: ['Hồ bơi', 'Wi-Fi miễn phí', 'Bữa sáng', 'Bãi đỗ xe', 'Hủy miễn phí', 'Điều hòa', 'Ban công', 'Smart TV'],
    image: require('./assets/a6086.png'),
    description: 'Kỳ nghỉ bên biển với hồ bơi và dịch vụ thân thiện, phù hợp cho gia đình và các chuyến đi ngắn ngày.',
  },
  {
    id: 'sunset-bay', name: 'Sunset Bay Nha Trang Hotel', address: '25 Trần Phú', destination: 'Nha Trang', area: 'Trung tâm', distance: 'cách biển 450 m', distanceMeters: 450,
    rating: 8.7, reviews: 512, price: 1290000, type: 'HOTEL',
    amenities: ['Hồ bơi', 'Wi-Fi miễn phí', 'Bữa sáng', 'Hủy miễn phí'],
    image: require('./assets/a6086.png'),
    description: 'Khách sạn ven biển với không gian thoáng đãng, tiện lợi cho chuyến đi ngắn ngày tại Nha Trang.',
  },
];

export const DESTINATIONS = [
  { name: 'Đà Nẵng', detail: 'Biển xanh · 286 nơi ở', image: require('./assets/a6086.png') },
  { name: 'Hội An', detail: 'Phố cổ · 174 nơi ở', image: require('./assets/b561a.png') },
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
