export type HotelMapBounds = {
  northEast: { latitude: number; longitude: number };
  southWest: { latitude: number; longitude: number };
};

export type HotelMapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export const DEFAULT_VIETNAM_MAP_BOUNDS: HotelMapBounds = {
  northEast: { latitude: 23.4, longitude: 109.5 },
  southWest: { latitude: 8.2, longitude: 102 },
};

export function regionToBounds(region: HotelMapRegion): HotelMapBounds {
  const halfLatitude = Math.abs(region.latitudeDelta) / 2;
  const halfLongitude = Math.abs(region.longitudeDelta) / 2;
  return {
    northEast: {
      latitude: Math.min(90, region.latitude + halfLatitude),
      longitude: Math.min(180, region.longitude + halfLongitude),
    },
    southWest: {
      latitude: Math.max(-90, region.latitude - halfLatitude),
      longitude: Math.max(-180, region.longitude - halfLongitude),
    },
  };
}
