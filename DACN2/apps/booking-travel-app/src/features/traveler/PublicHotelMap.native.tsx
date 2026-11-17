import MapView, { Marker, type Region } from "react-native-maps";

import {
  DEFAULT_VIETNAM_MAP_BOUNDS,
  regionToBounds,
  type HotelMapBounds,
} from "./hotel-map";
import type { HotelMapMarker } from "./public-hotels";

export function PublicHotelMap({
  hotels,
  selectedId,
  onSelect,
  onBoundsChange,
}: {
  hotels: HotelMapMarker[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBoundsChange: (bounds: HotelMapBounds) => void;
}) {
  const mappedHotels = hotels.filter(
    (hotel) => hotel.latitude !== null && hotel.longitude !== null,
  );
  const first = mappedHotels[0];
  const region: Region = {
    latitude: first
      ? Number(first.latitude)
      : (DEFAULT_VIETNAM_MAP_BOUNDS.northEast.latitude +
          DEFAULT_VIETNAM_MAP_BOUNDS.southWest.latitude) /
        2,
    longitude: first
      ? Number(first.longitude)
      : (DEFAULT_VIETNAM_MAP_BOUNDS.northEast.longitude +
          DEFAULT_VIETNAM_MAP_BOUNDS.southWest.longitude) /
        2,
    latitudeDelta: first
      ? 0.15
      : DEFAULT_VIETNAM_MAP_BOUNDS.northEast.latitude -
        DEFAULT_VIETNAM_MAP_BOUNDS.southWest.latitude,
    longitudeDelta: first
      ? 0.15
      : DEFAULT_VIETNAM_MAP_BOUNDS.northEast.longitude -
        DEFAULT_VIETNAM_MAP_BOUNDS.southWest.longitude,
  };
  return (
    <MapView
      key={first?.id ?? "empty"}
      initialRegion={region}
      onMapReady={() => onBoundsChange(regionToBounds(region))}
      onRegionChangeComplete={(next) => onBoundsChange(regionToBounds(next))}
      style={{ flex: 1 }}
    >
      {mappedHotels.map((hotel) => (
        <Marker
          key={hotel.id}
          coordinate={{
            latitude: Number(hotel.latitude),
            longitude: Number(hotel.longitude),
          }}
          description={
            hotel.minPricePerNight
              ? `Từ ${Number(hotel.minPricePerNight).toLocaleString("vi-VN")} ${hotel.currency ?? "VND"}`
              : undefined
          }
          onPress={() => onSelect(hotel.id)}
          title={hotel.name}
          pinColor={hotel.id === selectedId ? "#1D4ED8" : "#EF4444"}
        />
      ))}
    </MapView>
  );
}
