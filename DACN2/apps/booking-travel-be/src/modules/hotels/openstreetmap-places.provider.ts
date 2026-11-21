import { Injectable } from '@nestjs/common';
import {
  type NearbyPlaceCategory,
  type ProviderNearbyPlace,
} from './nearby-places.types';

const PHOTON_URL = 'https://photon.komoot.io/api/';
const PROVIDER_TIMEOUT_MS = 7_000;
const RESULTS_PER_CATEGORY = 8;
const CATEGORY_QUERIES: Record<NearbyPlaceCategory, string> = {
  ATTRACTION: 'tourist attraction',
  BEACH: 'beach',
  FOOD: 'restaurant',
  SHOPPING: 'shopping mall',
  TRANSPORT: 'airport station',
  HEALTHCARE: 'hospital',
  EDUCATION: 'university',
};

type PhotonFeature = {
  properties?: {
    osm_type?: 'N' | 'W' | 'R';
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

function addressOf(properties: NonNullable<PhotonFeature['properties']>) {
  const street = [properties.housenumber, properties.street]
    .filter(Boolean)
    .join(' ');
  const parts = [
    street,
    properties.district,
    properties.city,
    properties.state,
    properties.country,
  ].filter((part, index, all): part is string =>
    Boolean(part && all.indexOf(part) === index),
  );
  return parts.join(', ') || null;
}

function categoryOf(properties: NonNullable<PhotonFeature['properties']>) {
  const { osm_key: key, osm_value: value } = properties;
  if (key === 'natural' && value === 'beach') return 'BEACH';
  if (
    key === 'tourism' &&
    [
      'attraction',
      'museum',
      'viewpoint',
      'theme_park',
      'zoo',
      'aquarium',
    ].includes(value ?? '')
  )
    return 'ATTRACTION';
  if (
    key === 'amenity' &&
    ['restaurant', 'cafe', 'fast_food', 'food_court'].includes(value ?? '')
  )
    return 'FOOD';
  if (
    (key === 'shop' &&
      ['mall', 'supermarket', 'department_store'].includes(value ?? '')) ||
    (key === 'amenity' && value === 'marketplace')
  )
    return 'SHOPPING';
  if (
    (key === 'amenity' &&
      ['bus_station', 'ferry_terminal'].includes(value ?? '')) ||
    (key === 'railway' &&
      ['station', 'halt', 'subway_entrance'].includes(value ?? '')) ||
    (key === 'aeroway' && ['aerodrome', 'terminal'].includes(value ?? ''))
  )
    return 'TRANSPORT';
  if (
    key === 'amenity' &&
    ['hospital', 'clinic', 'pharmacy'].includes(value ?? '')
  )
    return 'HEALTHCARE';
  if (
    key === 'amenity' &&
    ['university', 'college', 'school'].includes(value ?? '')
  )
    return 'EDUCATION';
  return null;
}

export function distanceMetersBetween(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(
    earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)),
  );
}

@Injectable()
export class OpenStreetMapPlacesProvider {
  async nearby(
    latitude: number,
    longitude: number,
    radiusMeters: number,
  ): Promise<ProviderNearbyPlace[]> {
    const latitudeDelta = radiusMeters / 111_320;
    const longitudeDelta =
      radiusMeters / (111_320 * Math.cos((latitude * Math.PI) / 180));
    const boundingBox = [
      longitude - longitudeDelta,
      latitude - latitudeDelta,
      longitude + longitudeDelta,
      latitude + latitudeDelta,
    ].join(',');
    const results = await Promise.allSettled(
      Object.entries(CATEGORY_QUERIES).map(async ([category, query]) => ({
        category: category as NearbyPlaceCategory,
        features: await this.search(query, boundingBox),
      })),
    );
    const successful = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    if (!successful.length) throw new Error('OpenStreetMap places unavailable');

    const unique = new Map<string, ProviderNearbyPlace>();
    for (const result of successful) {
      for (const feature of result.features) {
        const properties = feature.properties;
        const coordinates = feature.geometry?.coordinates;
        const category = properties ? categoryOf(properties) : null;
        if (
          !properties?.osm_type ||
          properties.osm_id === undefined ||
          !properties.name ||
          !coordinates ||
          !category
        )
          continue;
        const [placeLongitude, placeLatitude] = coordinates;
        const distanceMeters = distanceMetersBetween(
          latitude,
          longitude,
          placeLatitude,
          placeLongitude,
        );
        if (distanceMeters > radiusMeters) continue;
        const osmType = { N: 'node', W: 'way', R: 'relation' }[
          properties.osm_type
        ];
        const providerPlaceId = `${osmType}/${properties.osm_id}`;
        if (unique.has(providerPlaceId)) continue;
        unique.set(providerPlaceId, {
          providerPlaceId,
          name: properties.name,
          address: addressOf(properties),
          category,
          latitude: placeLatitude,
          longitude: placeLongitude,
          distanceMeters,
          sourceUrl: `https://www.openstreetmap.org/${providerPlaceId}`,
        });
      }
    }
    return [...unique.values()].sort(
      (left, right) => left.distanceMeters - right.distanceMeters,
    );
  }

  private async search(query: string, boundingBox: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    const url = new URL(PHOTON_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('bbox', boundingBox);
    url.searchParams.set('limit', RESULTS_PER_CATEGORY.toString());

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'BookingTravel/0.1 nearby-places' },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Photon HTTP ${response.status}`);
      const payload = (await response.json()) as { features?: PhotonFeature[] };
      return payload.features ?? [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
