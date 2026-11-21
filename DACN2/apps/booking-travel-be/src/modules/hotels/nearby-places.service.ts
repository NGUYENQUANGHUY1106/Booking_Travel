import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HotelStatus, type NearbyPlaceCache } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NearbyPlacesQueryDto } from './dto/nearby-places-query.dto';
import {
  NEARBY_PLACE_CATEGORIES,
  NEARBY_PLACE_CATEGORY_LABELS,
  type NearbyPlaceCategory,
} from './nearby-places.types';
import { OpenStreetMapPlacesProvider } from './openstreetmap-places.provider';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const SEARCH_RADIUS_METERS = 5_000;
const DEFAULT_RESULT_LIMIT = 20;
const PROVIDER = 'OPENSTREETMAP';
const ATTRIBUTION = '© OpenStreetMap contributors';
const ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright';

@Injectable()
export class NearbyPlacesService {
  private readonly logger = new Logger(NearbyPlacesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: OpenStreetMapPlacesProvider,
  ) {}

  async list(hotelId: string, query: NearbyPlacesQueryDto) {
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: hotelId,
        status: HotelStatus.APPROVED,
        isVisible: true,
        deletedAt: null,
      },
      select: { id: true, name: true, latitude: true, longitude: true },
    });
    if (!hotel)
      throw new NotFoundException('Không tìm thấy khách sạn công khai.');

    const latitude = hotel.latitude === null ? null : Number(hotel.latitude);
    const longitude = hotel.longitude === null ? null : Number(hotel.longitude);
    if (latitude === null || longitude === null) {
      return this.response(hotel, [], query, 'UNAVAILABLE', false, false);
    }

    const now = new Date();
    let places = await this.prisma.nearbyPlaceCache.findMany({
      where: { hotelId },
      orderBy: { distanceMeters: 'asc' },
    });
    const hasFreshCache = places.some((place) => place.expiresAt > now);
    let source: 'CACHE' | 'PROVIDER' | 'UNAVAILABLE' = hasFreshCache
      ? 'CACHE'
      : 'UNAVAILABLE';
    let stale = !hasFreshCache && places.length > 0;

    if (!hasFreshCache) {
      try {
        const fetched = await this.provider.nearby(
          latitude,
          longitude,
          SEARCH_RADIUS_METERS,
        );
        if (fetched.length) {
          const fetchedAt = new Date();
          const expiresAt = new Date(fetchedAt.getTime() + CACHE_TTL_MS);
          places = await this.prisma.$transaction(async (transaction) => {
            await transaction.nearbyPlaceCache.deleteMany({
              where: { hotelId },
            });
            await transaction.nearbyPlaceCache.createMany({
              data: fetched.map((place) => ({
                ...place,
                hotelId,
                provider: PROVIDER,
                attribution: ATTRIBUTION,
                fetchedAt,
                expiresAt,
              })),
            });
            return transaction.nearbyPlaceCache.findMany({
              where: { hotelId },
              orderBy: { distanceMeters: 'asc' },
            });
          });
          source = 'PROVIDER';
          stale = false;
        }
      } catch (error) {
        this.logger.warn(
          `Không tải được địa điểm lân cận cho hotel ${hotelId}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }

    return this.response(hotel, places, query, source, true, stale);
  }

  private response(
    hotel: {
      id: string;
      name: string;
      latitude: { toString(): string } | null;
      longitude: { toString(): string } | null;
    },
    places: NearbyPlaceCache[],
    query: NearbyPlacesQueryDto,
    source: 'CACHE' | 'PROVIDER' | 'UNAVAILABLE',
    hasLocation: boolean,
    stale: boolean,
  ) {
    const filtered = places
      .filter((place) => !query.category || place.category === query.category)
      .slice(0, query.limit ?? DEFAULT_RESULT_LIMIT);
    const categories = query.category
      ? [query.category]
      : [...NEARBY_PLACE_CATEGORIES];
    const groups = categories.flatMap((category) => {
      const items = filtered.filter((place) => place.category === category);
      return items.length
        ? [
            {
              category,
              label: NEARBY_PLACE_CATEGORY_LABELS[category],
              items: items.map((place) => this.place(place)),
            },
          ]
        : [];
    });

    return {
      hotel: {
        id: hotel.id,
        name: hotel.name,
        latitude: hotel.latitude?.toString() ?? null,
        longitude: hotel.longitude?.toString() ?? null,
      },
      radiusMeters: SEARCH_RADIUS_METERS,
      source,
      stale,
      hasLocation,
      items: filtered.map((place) => this.place(place)),
      groups,
      attribution: {
        provider: 'OpenStreetMap',
        text: ATTRIBUTION,
        url: ATTRIBUTION_URL,
      },
      refreshedAt: places[0]?.fetchedAt.toISOString() ?? null,
    };
  }

  private place(place: NearbyPlaceCache) {
    return {
      id: place.id,
      name: place.name,
      address: place.address,
      category: place.category as NearbyPlaceCategory,
      latitude: place.latitude.toString(),
      longitude: place.longitude.toString(),
      distanceMeters: place.distanceMeters,
      sourceUrl: place.sourceUrl,
    };
  }
}
