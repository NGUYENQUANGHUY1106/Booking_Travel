import { Injectable } from '@nestjs/common';
import type {
  TravelAmenityPreference,
  TravelAreaPreference,
  TravelTripType,
  UserPreference,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { publicStayDates } from '../rooms/inventory';
import { HotelsService } from '../hotels/hotels.service';
import type { HotelRecommendationQueryDto } from './dto/hotel-recommendation-query.dto';

const AMENITY_NAMES: Record<TravelAmenityPreference, readonly string[]> = {
  WIFI: ['wifi', 'wi-fi', 'wi-fi miễn phí', 'wifi miễn phí', 'free wi-fi'],
  BREAKFAST: ['bữa sáng', 'bao gồm bữa sáng', 'breakfast'],
  POOL: ['hồ bơi', 'bể bơi', 'pool', 'swimming pool'],
  PARKING: ['bãi đỗ xe', 'chỗ đỗ xe', 'parking'],
  SPA: ['spa'],
  GYM: ['gym', 'phòng gym', 'phòng tập', 'fitness center'],
  BEACH: ['bãi biển riêng', 'private beach', 'beach access', 'lối ra bãi biển'],
  AIRPORT_SHUTTLE: ['đưa đón sân bay', 'airport shuttle'],
  PET_FRIENDLY: ['cho phép thú cưng', 'pet friendly', 'pet-friendly'],
  FAMILY_ROOM: ['phòng gia đình', 'family room'],
};
const AREA_NAMES: Record<TravelAreaPreference, readonly string[]> = {
  BEACHFRONT: ['giáp biển', 'sát biển', 'beachfront'],
  CITY_CENTER: ['trung tâm thành phố', 'city center', 'city centre'],
  QUIET: ['khu vực yên tĩnh', 'quiet area'],
  NEAR_AIRPORT: ['gần sân bay', 'near airport'],
  NEAR_ATTRACTIONS: ['gần điểm tham quan', 'near attractions'],
  NIGHTLIFE: ['gần khu vui chơi về đêm', 'near nightlife'],
  LOCAL_CULTURE: ['gần phố cổ', 'near old town'],
  NATURE: ['gần thiên nhiên', 'near nature'],
};
const TRIP_AMENITIES: Partial<Record<TravelTripType, TravelAmenityPreference>> =
  {
    FAMILY: 'FAMILY_ROOM',
    BUSINESS: 'WIFI',
    WELLNESS: 'SPA',
  };

type Hotel = Awaited<ReturnType<HotelsService['list']>>[number];
type Preferences = Pick<
  UserPreference,
  | 'budgetMin'
  | 'budgetMax'
  | 'currency'
  | 'accommodationTypes'
  | 'preferredAmenities'
  | 'preferredAreas'
  | 'tripTypes'
>;

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

function matchName(names: readonly string[], available: Map<string, string>) {
  return names.map((name) => available.get(normalize(name))).find(Boolean);
}

function matchPreferences(
  hotel: Hotel,
  preference: Preferences | null,
  stayNights?: number,
  roomCount = 1,
) {
  let points = 0;
  const reasons: string[] = [];
  if (!preference) return { points, reasons };
  const price =
    stayNights && hotel.stayPriceFrom
      ? Number(hotel.stayPriceFrom) / (stayNights * roomCount)
      : hotel.minPricePerNight === null
        ? null
        : Number(hotel.minPricePerNight);
  const amenities = new Map(
    hotel.amenities.map(({ name }) => [normalize(name), name]),
  );

  if (
    price !== null &&
    hotel.currency === preference.currency &&
    (preference.budgetMin !== null || preference.budgetMax !== null) &&
    price >= (preference.budgetMin ?? 0) &&
    price <= (preference.budgetMax ?? Infinity)
  ) {
    points += 5;
    reasons.push(
      stayNights
        ? 'Giá trung bình mỗi phòng mỗi đêm phù hợp ngân sách'
        : 'Giá phòng từ phù hợp với ngân sách đã chọn',
    );
  }
  if (
    hotel.accommodationType &&
    preference.accommodationTypes.includes(hotel.accommodationType)
  ) {
    points += 4;
    reasons.push('Đúng loại chỗ ở bạn đã chọn');
  }

  const selectedAmenities = preference.preferredAmenities.flatMap((amenity) => {
    const name = matchName(AMENITY_NAMES[amenity], amenities);
    return name ? [name] : [];
  });
  if (selectedAmenities.length) {
    points += Math.min(selectedAmenities.length, 3) * 2;
    reasons.push(
      'Có tiện nghi bạn chọn: ' + selectedAmenities.slice(0, 3).join(', '),
    );
  }
  const selectedAreas = preference.preferredAreas.flatMap((area) => {
    const name = matchName(AREA_NAMES[area], amenities);
    return name ? [name] : [];
  });
  if (selectedAreas.length) {
    points += Math.min(selectedAreas.length, 2) * 2;
    reasons.push('Phù hợp khu vực bạn chọn: ' + selectedAreas.join(', '));
  }
  for (const trip of preference.tripTypes) {
    const amenity = TRIP_AMENITIES[trip];
    const name = amenity && matchName(AMENITY_NAMES[amenity], amenities);
    if (name && !selectedAmenities.includes(name)) {
      points += 1;
      reasons.push(name + ' phù hợp với loại chuyến đi của bạn');
      break;
    }
  }
  return { points, reasons };
}

@Injectable()
export class HotelRecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hotels: HotelsService,
  ) {}

  async list(input: HotelRecommendationQueryDto, user?: AuthenticatedUser) {
    const { limit = 6, ...context } = input;
    const stayNights =
      context.checkIn && context.checkOut
        ? publicStayDates(context.checkIn, context.checkOut).length
        : undefined;
    const [candidates, preference] = await Promise.all([
      this.hotels.list(context),
      user
        ? this.prisma.userPreference.findUnique({
            where: { userId: user.id },
            select: {
              budgetMin: true,
              budgetMax: true,
              currency: true,
              accommodationTypes: true,
              preferredAmenities: true,
              preferredAreas: true,
              tripTypes: true,
            },
          })
        : null,
    ]);

    // Weight very small review samples towards the neutral prior.
    const items = candidates
      .map((hotel) => {
        const { points, reasons } = matchPreferences(
          hotel,
          preference,
          stayNights,
          context.rooms,
        );
        const quality =
          hotel.reviewScore === null
            ? 0
            : (hotel.reviewScore * hotel.reviewCount + 7 * 5) /
              (hotel.reviewCount + 5);
        return { hotel, reasons, score: points + quality * 0.25 };
      })
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.hotel.reviewCount - left.hotel.reviewCount ||
          left.hotel.id.localeCompare(right.hotel.id),
      )
      .slice(0, limit);
    return {
      mode: items.some(({ reasons }) => reasons.length)
        ? 'PERSONALIZED'
        : 'DISCOVERY',
      items: items.map(({ hotel, reasons }) => ({
        reasons: reasons.length
          ? reasons
          : hotel.reviewCount > 0
            ? ['Xếp hạng theo điểm và số lượt đánh giá']
            : [],
        hotel: {
          id: hotel.id,
          name: hotel.name,
          addressLine: hotel.addressLine,
          city: hotel.city,
          province: hotel.province,
          latitude: hotel.latitude,
          longitude: hotel.longitude,
          description: hotel.description,
          coverImageUrl: hotel.coverImageUrl,
          accommodationType: hotel.accommodationType,
          starRating: hotel.starRating,
          roomCount: hotel.roomCount,
          minPricePerNight: hotel.minPricePerNight,
          stayPriceFrom: hotel.stayPriceFrom,
          stayNights,
          reviewScore: hotel.reviewScore,
          reviewCount: hotel.reviewCount,
          currency: hotel.currency,
          freeCancellation: hotel.freeCancellation,
          createdAt: hotel.createdAt,
          updatedAt: hotel.updatedAt,
          amenities: hotel.amenities,
        },
      })),
    };
  }
}
