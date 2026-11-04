import MapView, { Marker, type Region } from 'react-native-maps';

import type { PublicHotel } from './public-hotels';

export function PublicHotelMap({ hotels, selectedId, onSelect, onSearchArea }: { hotels: PublicHotel[]; selectedId?: string; onSelect: (id: string) => void; onSearchArea: (center: { latitude: number; longitude: number }) => void }) {
  const first = hotels[0];
  const region: Region = {
    latitude: Number(first?.latitude ?? 16.0544),
    longitude: Number(first?.longitude ?? 108.2022),
    latitudeDelta: 0.15,
    longitudeDelta: 0.15,
  };
  return <MapView key={first?.id ?? 'empty'} initialRegion={region} onRegionChangeComplete={(next) => onSearchArea({ latitude: next.latitude, longitude: next.longitude })} style={{ flex: 1 }}>
    {hotels.map((hotel) => <Marker key={hotel.id} coordinate={{ latitude: Number(hotel.latitude), longitude: Number(hotel.longitude) }} onPress={() => onSelect(hotel.id)} title={hotel.name} pinColor={hotel.id === selectedId ? '#1D4ED8' : '#EF4444'} />)}
  </MapView>;
}
