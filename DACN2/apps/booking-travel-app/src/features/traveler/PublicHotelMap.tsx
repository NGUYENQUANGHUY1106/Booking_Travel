import { View } from 'react-native';

import type { PublicHotel } from './public-hotels';
import { T } from './ui';

export function PublicHotelMap({ hotels }: { hotels: PublicHotel[]; selectedId?: string; onSelect: (id: string) => void; onSearchArea: (center: { latitude: number; longitude: number }) => void }) {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}><T>Đã tìm thấy {hotels.length} chỗ ở. Bản đồ tương tác khả dụng trên Expo iOS/Android.</T></View>;
}
