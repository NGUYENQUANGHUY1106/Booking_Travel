import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelStatus, Prisma, RoomStatus, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { HotelQueryDto } from './dto/hotel-query.dto';
import { HotelStaySearchQueryDto } from './dto/hotel-stay-search-query.dto';
import { HotelMapSearchQueryDto } from './dto/hotel-map-search-query.dto';
import { NearbyHotelSearchQueryDto } from './dto/nearby-hotel-search-query.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import {
  CreateOwnerHotelDraftDto,
  UpdateApprovedRefundRulesDto,
  UpdateOwnerHotelProfileDto,
} from './dto/owner-hotel-profile.dto';
import { HotelMediaService } from './hotel-media.service';
import { hotelSubmissionReadiness } from './hotel-submission-readiness';
import {
  loadInventoryForRooms,
  minimumAvailable,
  publicStayDates,
} from '../rooms/inventory';
import { resolveNightlyRates } from '../pricing/pricing.domain';
import { parseRefundRules } from '../bookings/refund-policy';

const ownerProfileInclude = {
  policy: true,
  amenityLinks: { select: { amenityId: true } },
  _count: {
    select: {
      rooms: {
        where: {
          deletedAt: null,
          status: RoomStatus.ACTIVE,
          quantity: { gt: 0 },
        },
      },
      bookings: true,
    },
  },
} as const;

const MAX_MAP_CANDIDATES = 500;
const DEFAULT_MAP_MARKER_LIMIT = 50;

function normalizedSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .trim();
}

function hasFreeCancellation(policy?: string | null) {
  if (!policy) return false;
  const value = normalizedSearchText(policy);
  return value.includes('mien phi') || value.includes('free cancellation');
}

type OwnerProfileRecord = Prisma.HotelGetPayload<{
  include: typeof ownerProfileInclude;
}>;

type GalleryItem = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  isCover: boolean;
  url: string;
};

function ownerProfile(
  record: OwnerProfileRecord,
  gallery: GalleryItem[],
  latestSubmission?: {
    id: string;
    version: number;
    status: string;
    reason: string | null;
    submittedAt: Date;
    decidedAt: Date | null;
  },
) {
  const { _count, amenityLinks, ...hotel } = record;
  const coverImageUrl =
    gallery.find((image) => image.isCover)?.url ?? hotel.coverImageUrl;
  const readiness = hotelSubmissionReadiness(hotel, gallery, _count.rooms);
  return {
    ...hotel,
    coverImageUrl,
    gallery,
    amenities: amenityLinks.length
      ? amenityLinks.map((link) => link.amenityId)
      : hotel.amenities,
    roomCount: _count.rooms,
    bookingCount: _count.bookings,
    ...readiness,
    latestSubmission: latestSubmission ?? null,
  };
}

function assertEditable(status: HotelStatus) {
  if (status !== HotelStatus.DRAFT && status !== HotelStatus.REJECTED) {
    throw new ConflictException(
      'Chỉ hồ sơ bản nháp hoặc bị từ chối mới được chỉnh sửa.',
    );
  }
}

@Injectable()
export class HotelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly media: HotelMediaService,
  ) {}

  async list(
    query: HotelQueryDto,
    user?: AuthenticatedUser,
    allowedHotelIds?: string[],
  ) {
    if (Boolean(query.checkIn) !== Boolean(query.checkOut))
      throw new BadRequestException(
        'Cần cả ngày nhận và trả phòng để lọc chỗ ở.',
      );
    const stayDates =
      query.checkIn && query.checkOut
        ? publicStayDates(query.checkIn, query.checkOut)
        : null;
    const canModerate =
      user?.role === UserRole.ADMIN &&
      user.permissions.includes('HOTEL_REVIEW');
    const ownerScope =
      user?.role === UserRole.HOTEL_OWNER && query.ownerId === user.id;
    if (query.ownerId && !ownerScope && !canModerate) {
      throw new ForbiddenException(
        'Không được xem danh sách của chủ khách sạn khác.',
      );
    }
    if (
      query.status &&
      query.status !== HotelStatus.APPROVED &&
      !ownerScope &&
      !canModerate
    ) {
      throw new ForbiddenException('Không được xem khách sạn chưa công khai.');
    }

    const hasGeoFilter =
      query.latitude !== undefined ||
      query.longitude !== undefined ||
      query.radiusKm !== undefined;
    if (
      hasGeoFilter &&
      (query.latitude === undefined ||
        query.longitude === undefined ||
        query.radiusKm === undefined)
    )
      throw new BadRequestException(
        'Cần đủ vĩ độ, kinh độ và bán kính tìm kiếm.',
      );
    const amenityIds =
      query.amenityIds
        ?.split(',')
        .map((id) => id.trim())
        .filter(Boolean) ?? [];
    const publicGeoScope =
      ownerScope || canModerate
        ? Prisma.empty
        : Prisma.sql`AND "deletedAt" IS NULL AND "status" = 'APPROVED' AND "isVisible" = true`;
    const nearbyIds = hasGeoFilter
      ? (
          await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Hotel"
          WHERE "location" IS NOT NULL
            ${publicGeoScope}
            AND ST_DWithin(
              "location",
              ST_SetSRID(ST_MakePoint(${query.longitude!}, ${query.latitude!}), 4326)::geography,
              ${query.radiusKm! * 1000}
            )
        `
        ).map((row) => row.id)
      : undefined;
    const scopedIds =
      allowedHotelIds && nearbyIds
        ? allowedHotelIds.filter((id) => nearbyIds.includes(id))
        : (allowedHotelIds ?? nearbyIds);

    const search = query.search?.trim();
    const requestedRooms = query.rooms ?? 1;
    const publicRoomWhere: Prisma.RoomWhereInput = {
      deletedAt: null,
      status: RoomStatus.ACTIVE,
      quantity: { gte: requestedRooms },
      capacityAdults: {
        gte: Math.ceil((query.adults ?? 1) / requestedRooms),
      },
      capacityChildren: {
        gte: Math.ceil((query.children ?? 0) / requestedRooms),
      },
    };
    const where: Prisma.HotelWhereInput = {
      id: scopedIds ? { in: scopedIds } : undefined,
      deletedAt: null,
      ownerId: ownerScope || canModerate ? query.ownerId : undefined,
      status: ownerScope || canModerate ? query.status : HotelStatus.APPROVED,
      isVisible: ownerScope || canModerate ? undefined : true,
      rooms: ownerScope || canModerate ? undefined : { some: publicRoomWhere },
      AND: amenityIds.map((amenityId) => ({
        amenityLinks: { some: { amenityId } },
      })),
      city: query.city
        ? { equals: query.city.trim(), mode: 'insensitive' }
        : undefined,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { addressLine: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { district: { contains: search, mode: 'insensitive' } },
            { ward: { contains: search, mode: 'insensitive' } },
            { province: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const records = await this.prisma.hotel.findMany({
      where,
      omit: { clientDraftId: true },
      include: {
        policy: { select: { cancellationPolicy: true } },
        amenityLinks: {
          select: { amenityId: true, amenity: { select: { name: true } } },
        },
        rooms: {
          where:
            ownerScope || canModerate
              ? {
                  deletedAt: null,
                  status: RoomStatus.ACTIVE,
                  quantity: { gt: 0 },
                }
              : publicRoomWhere,
          select: { basePrice: true, currency: true },
          orderBy: { basePrice: 'asc' },
          take: 1,
        },
        _count: {
          select: {
            rooms: {
              where: {
                deletedAt: null,
                status: RoomStatus.ACTIVE,
                quantity: { gt: 0 },
              },
            },
          },
        },
        owner: {
          select: {
            id: true,
            fullName: true,
            email: Boolean(ownerScope || canModerate),
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const sellableByHotel = new Map<
      string,
      { basePrice: Prisma.Decimal; currency: string }
    >();
    if (stayDates && !ownerScope && !canModerate) {
      const candidates = await this.prisma.room.findMany({
        where: {
          ...publicRoomWhere,
          hotelId: { in: records.map((record) => record.id) },
        },
        select: {
          id: true,
          hotelId: true,
          quantity: true,
          basePrice: true,
          currency: true,
        },
      });
      const allRules = candidates.length
        ? await this.prisma.roomPricingRule.findMany({
            where: {
              roomId: { in: candidates.map((room) => room.id) },
              active: true,
              startDate: {
                lt: new Date(
                  stayDates[stayDates.length - 1].getTime() + 86_400_000,
                ),
              },
              endDateExclusive: { gt: stayDates[0] },
            },
          })
        : [];
      const rulesByRoom = new Map<string, typeof allRules>();
      for (const rule of allRules) {
        const rules = rulesByRoom.get(rule.roomId) ?? [];
        rules.push(rule);
        rulesByRoom.set(rule.roomId, rules);
      }
      const inventories = await loadInventoryForRooms(
        this.prisma,
        candidates,
        stayDates,
      );
      for (const room of candidates) {
        const count = minimumAvailable(inventories.get(room.id) ?? []);
        if (count < (query.rooms ?? 1)) continue;
        const rates = resolveNightlyRates(
          room.basePrice,
          stayDates,
          rulesByRoom.get(room.id) ?? [],
        );
        const lowestRate = rates.reduce(
          (lowest, rate) => (rate.price.lt(lowest) ? rate.price : lowest),
          rates[0].price,
        );
        const current = sellableByHotel.get(room.hotelId);
        if (!current || lowestRate.lt(current.basePrice))
          sellableByHotel.set(room.hotelId, {
            basePrice: lowestRate,
            currency: room.currency,
          });
      }
    }
    const visibleRecords =
      stayDates && !ownerScope && !canModerate
        ? records.filter((record) => sellableByHotel.has(record.id))
        : records;
    const galleries = await this.media.listMetadata(
      visibleRecords.map((record) => record.id),
      ownerScope || canModerate ? 'private' : 'public',
    );
    return visibleRecords.map((record) => {
      const { rooms, _count, amenityLinks, policy, ...hotel } = record;
      return {
        ...hotel,
        roomCount: _count.rooms,
        minPricePerNight:
          (
            sellableByHotel.get(hotel.id)?.basePrice ?? rooms[0]?.basePrice
          )?.toString() ?? null,
        currency:
          sellableByHotel.get(hotel.id)?.currency ?? rooms[0]?.currency ?? null,
        amenities: amenityLinks.map((link) => ({
          id: link.amenityId,
          name: link.amenity.name,
        })),
        freeCancellation: hasFreeCancellation(policy?.cancellationPolicy),
        reviewScore: null,
        reviewCount: 0,
        coverImageUrl:
          galleries.get(hotel.id)?.find((image) => image.isCover)?.url ??
          hotel.coverImageUrl,
      };
    });
  }

  async search(query: HotelStaySearchQueryDto, allowedHotelIds?: string[]) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException(
        'Giá tối thiểu không được lớn hơn giá tối đa.',
      );

    const stayNights = publicStayDates(query.checkIn, query.checkOut).length;
    // shortcut: facets cần toàn bộ tập còn phòng; chuyển sang search index khi dữ liệu công khai tăng lớn.
    const results = await this.list(
      {
        search: query.destination.trim(),
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        adults: query.adults,
        children: query.children,
        rooms: query.rooms,
      },
      undefined,
      allowedHotelIds,
    );
    const candidates = results.map((hotel) => ({
      ...hotel,
      stayNights,
      stayPriceFrom: hotel.minPricePerNight
        ? new Prisma.Decimal(hotel.minPricePerNight)
            .mul(stayNights)
            .mul(query.rooms)
            .toString()
        : null,
    }));
    const requestedAmenities = new Set(
      query.amenities?.map(normalizedSearchText) ?? [],
    );
    const filtered = candidates.filter((hotel) => {
      const price = hotel.minPricePerNight
        ? Number(hotel.minPricePerNight)
        : null;
      const amenities = new Set(
        hotel.amenities.map((amenity) => normalizedSearchText(amenity.name)),
      );
      return (
        (query.minPrice === undefined ||
          (price !== null && price >= query.minPrice)) &&
        (query.maxPrice === undefined ||
          (price !== null && price <= query.maxPrice)) &&
        (!query.stars?.length || query.stars.includes(hotel.starRating)) &&
        (!query.minReviewScore ||
          (hotel.reviewScore !== null &&
            hotel.reviewScore >= query.minReviewScore)) &&
        (!query.propertyTypes?.length ||
          (hotel.accommodationType !== null &&
            query.propertyTypes.includes(hotel.accommodationType))) &&
        [...requestedAmenities].every((amenity) => amenities.has(amenity)) &&
        (!query.freeCancellation || hotel.freeCancellation)
      );
    });
    const price = (hotel: (typeof filtered)[number]) =>
      hotel.minPricePerNight === null ? null : Number(hotel.minPricePerNight);
    const comparePrice = (
      left: (typeof filtered)[number],
      right: (typeof filtered)[number],
      direction: 1 | -1,
    ) => {
      const leftPrice = price(left);
      const rightPrice = price(right);
      if (leftPrice === null) return rightPrice === null ? 0 : 1;
      if (rightPrice === null) return -1;
      return (leftPrice - rightPrice) * direction;
    };
    const sorted = [...filtered].sort((left, right) => {
      let comparison = 0;
      if (query.sort === 'priceAsc') comparison = comparePrice(left, right, 1);
      else if (query.sort === 'priceDesc')
        comparison = comparePrice(left, right, -1);
      else if (query.sort === 'rating')
        comparison = right.starRating - left.starRating;
      else
        comparison =
          right.starRating - left.starRating || comparePrice(left, right, 1);
      return comparison || left.id.localeCompare(right.id);
    });
    const typeCounts = new Map<string, number>();
    const starCounts = new Map<number, number>();
    const amenityCounts = new Map<string, { name: string; count: number }>();
    for (const hotel of candidates) {
      if (hotel.accommodationType)
        typeCounts.set(
          hotel.accommodationType,
          (typeCounts.get(hotel.accommodationType) ?? 0) + 1,
        );
      starCounts.set(
        hotel.starRating,
        (starCounts.get(hotel.starRating) ?? 0) + 1,
      );
      for (const amenity of hotel.amenities) {
        const key = normalizedSearchText(amenity.name);
        amenityCounts.set(key, {
          name: amenity.name,
          count: (amenityCounts.get(key)?.count ?? 0) + 1,
        });
      }
    }
    const prices = candidates
      .map(price)
      .filter((value): value is number => value !== null);
    const total = sorted.length;
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      criteria: {
        destination: query.destination.trim(),
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        adults: query.adults,
        children: query.children,
        rooms: query.rooms,
        minPrice: query.minPrice ?? null,
        maxPrice: query.maxPrice ?? null,
        stars: query.stars ?? [],
        minReviewScore: query.minReviewScore ?? null,
        propertyTypes: query.propertyTypes ?? [],
        amenities: query.amenities ?? [],
        freeCancellation: query.freeCancellation ?? false,
        sort: query.sort ?? 'recommended',
      },
      facets: {
        price: {
          min: prices.length ? Math.min(...prices) : null,
          max: prices.length ? Math.max(...prices) : null,
        },
        stars: [...starCounts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((left, right) => right.value - left.value),
        propertyTypes: [...typeCounts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((left, right) => left.value.localeCompare(right.value)),
        amenities: [...amenityCounts.values()].sort((left, right) =>
          left.name.localeCompare(right.name, 'vi'),
        ),
        freeCancellation: candidates.filter((hotel) => hotel.freeCancellation)
          .length,
        reviewScoreAvailable: candidates.filter(
          (hotel) => hotel.reviewScore !== null,
        ).length,
      },
    };
  }

  async mapSearch(query: HotelMapSearchQueryDto) {
    const {
      northEastLatitude,
      northEastLongitude,
      southWestLatitude,
      southWestLongitude,
    } = query;
    if (
      northEastLatitude <= southWestLatitude ||
      northEastLongitude <= southWestLongitude
    ) {
      throw new BadRequestException(
        'Phạm vi bản đồ không hợp lệ: góc đông bắc phải nằm trên và bên phải góc tây nam.',
      );
    }

    const boundedRows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Hotel"
      WHERE "location" IS NOT NULL
        AND "deletedAt" IS NULL
        AND "status" = 'APPROVED'
        AND "isVisible" = true
        AND ST_Intersects(
          "location",
          ST_MakeEnvelope(
            ${southWestLongitude},
            ${southWestLatitude},
            ${northEastLongitude},
            ${northEastLatitude},
            4326
          )::geography
        )
      ORDER BY "id"
      LIMIT ${MAX_MAP_CANDIDATES + 1}
    `;
    const candidateOverflow = boundedRows.length > MAX_MAP_CANDIDATES;
    const boundedIds = new Set(
      boundedRows.slice(0, MAX_MAP_CANDIDATES).map((row) => row.id),
    );
    if (!boundedIds.size) {
      return {
        items: [],
        truncated: false,
        criteria: this.mapCriteria(query),
      };
    }

    // Reuse the stay search so availability, pricing and advanced filters stay identical.
    const searched = await this.search(
      {
        ...query,
        page: 1,
        limit: Number.MAX_SAFE_INTEGER,
      },
      [...boundedIds],
    );
    const matching = searched.items.filter((hotel) => boundedIds.has(hotel.id));
    const markerLimit = query.limit ?? DEFAULT_MAP_MARKER_LIMIT;
    return {
      items: matching.slice(0, markerLimit).map((hotel) => ({
        id: hotel.id,
        name: hotel.name,
        latitude: hotel.latitude,
        longitude: hotel.longitude,
        starRating: hotel.starRating,
        accommodationType: hotel.accommodationType,
        minPricePerNight: hotel.minPricePerNight,
        stayPriceFrom: hotel.stayPriceFrom,
        currency: hotel.currency,
      })),
      truncated: candidateOverflow || matching.length > markerLimit,
      criteria: this.mapCriteria(query),
    };
  }

  private mapCriteria(query: HotelMapSearchQueryDto) {
    return {
      bounds: {
        northEast: {
          latitude: query.northEastLatitude,
          longitude: query.northEastLongitude,
        },
        southWest: {
          latitude: query.southWestLatitude,
          longitude: query.southWestLongitude,
        },
      },
      destination: query.destination.trim(),
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      adults: query.adults,
      children: query.children,
      rooms: query.rooms,
      minPrice: query.minPrice ?? null,
      maxPrice: query.maxPrice ?? null,
      stars: query.stars ?? [],
      minReviewScore: query.minReviewScore ?? null,
      propertyTypes: query.propertyTypes ?? [],
      amenities: query.amenities ?? [],
      freeCancellation: query.freeCancellation ?? false,
      sort: query.sort ?? 'recommended',
    };
  }

  async nearbySearch(query: NearbyHotelSearchQueryDto) {
    const hasLatitude = query.latitude !== undefined;
    const hasLongitude = query.longitude !== undefined;
    const hasCoordinates = hasLatitude && hasLongitude;
    const hasLandmark = Boolean(query.landmark?.trim());
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('Cần cung cấp đủ vĩ độ và kinh độ.');
    }
    if (hasCoordinates === hasLandmark) {
      throw new BadRequestException(
        'Chỉ chọn một nguồn tìm kiếm: vị trí hiện tại hoặc điểm mốc.',
      );
    }

    let latitude = query.latitude;
    let longitude = query.longitude;
    let label = 'Vị trí hiện tại';
    let source: 'CURRENT_LOCATION' | 'LANDMARK' = 'CURRENT_LOCATION';
    if (hasLandmark) {
      const requestedLandmark = normalizedSearchText(query.landmark!);
      const landmark = await this.prisma.landmark.findFirst({
        where: {
          isActive: true,
          OR: [
            { normalizedName: requestedLandmark },
            { normalizedName: { contains: requestedLandmark } },
          ],
        },
        orderBy: { name: 'asc' },
      });
      if (!landmark) {
        throw new NotFoundException(
          'Không tìm thấy điểm mốc. Hãy thử Cầu Rồng, Mỹ Khê hoặc Phố cổ Hội An.',
        );
      }
      latitude = Number(landmark.latitude);
      longitude = Number(landmark.longitude);
      label = landmark.name;
      source = 'LANDMARK';
    }

    const pointLatitude = latitude!;
    const pointLongitude = longitude!;
    const nearbyRows = await this.prisma.$queryRaw<
      { id: string; distanceMeters: number }[]
    >`
      SELECT "id",
        ST_Distance(
          "location",
          ST_SetSRID(ST_MakePoint(${pointLongitude}, ${pointLatitude}), 4326)::geography
        ) AS "distanceMeters"
      FROM "Hotel"
      WHERE "location" IS NOT NULL
        AND "deletedAt" IS NULL
        AND "status" = 'APPROVED'
        AND "isVisible" = true
        AND ST_DWithin(
          "location",
          ST_SetSRID(ST_MakePoint(${pointLongitude}, ${pointLatitude}), 4326)::geography,
          ${query.radiusKm * 1000}
        )
      ORDER BY "distanceMeters" ASC, "id" ASC
    `;
    const distanceByHotel = new Map(
      nearbyRows.map((row) => [row.id, Number(row.distanceMeters)]),
    );
    const searchResult = await this.search(
      {
        destination: '',
        checkIn: query.checkIn,
        checkOut: query.checkOut,
        adults: query.adults,
        children: query.children,
        rooms: query.rooms,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        stars: query.stars,
        minReviewScore: query.minReviewScore,
        propertyTypes: query.propertyTypes,
        amenities: query.amenities,
        freeCancellation: query.freeCancellation,
        sort: query.sort,
        page: 1,
        limit: Math.max(1, nearbyRows.length),
      },
      nearbyRows.map((row) => row.id),
    );
    const withDistance = searchResult.items.map((hotel) => ({
      ...hotel,
      distanceMeters: distanceByHotel.get(hotel.id) ?? null,
    }));
    const sorted =
      query.nearbySort === 'recommended'
        ? withDistance
        : [...withDistance].sort(
            (left, right) =>
              (left.distanceMeters ?? Number.POSITIVE_INFINITY) -
                (right.distanceMeters ?? Number.POSITIVE_INFINITY) ||
              left.id.localeCompare(right.id),
          );
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;

    return {
      ...searchResult,
      items: sorted.slice(start, start + limit),
      pagination: {
        page,
        limit,
        total: sorted.length,
        totalPages: Math.ceil(sorted.length / limit),
      },
      anchor: {
        source,
        label,
        latitude: pointLatitude,
        longitude: pointLongitude,
        radiusKm: query.radiusKm,
      },
      criteria: {
        ...searchResult.criteria,
        nearbySort: query.nearbySort ?? 'distance',
      },
    };
  }

  async get(id: string, user?: AuthenticatedUser) {
    const scope = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
      select: { ownerId: true, status: true, isVisible: true },
    });
    if (!scope) throw new NotFoundException('Không tìm thấy khách sạn.');
    const isOwner =
      user?.role === UserRole.HOTEL_OWNER && scope.ownerId === user.id;
    const canModerate =
      user?.role === UserRole.ADMIN &&
      user.permissions.includes('HOTEL_REVIEW');
    if (
      (scope.status !== HotelStatus.APPROVED || !scope.isVisible) &&
      !isOwner &&
      !canModerate
    ) {
      throw new ForbiddenException('Không được xem khách sạn chưa công khai.');
    }

    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id,
        deletedAt: null,
        ownerId: isOwner ? user?.id : undefined,
        status: isOwner || canModerate ? undefined : HotelStatus.APPROVED,
        isVisible: isOwner || canModerate ? undefined : true,
      },
      include: {
        amenityLinks: {
          select: { amenityId: true, amenity: { select: { name: true } } },
        },
        owner: {
          select: {
            id: true,
            fullName: true,
            email: Boolean(isOwner || canModerate),
          },
        },
        rooms: {
          where: {
            deletedAt: null,
            status: isOwner || canModerate ? undefined : RoomStatus.ACTIVE,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      omit: { clientDraftId: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    const galleries = await this.media.listMetadata(
      [hotel.id],
      isOwner || canModerate ? 'private' : 'public',
    );
    const gallery = galleries.get(hotel.id) ?? [];
    const roomImages = await this.media.listRoomMetadataForRooms(
      hotel.rooms.map((room) => room.id),
      isOwner || canModerate ? 'private' : 'public',
    );
    const roomAmenityIds = [
      ...new Set(hotel.rooms.flatMap((room) => room.amenities)),
    ];
    const roomAmenityCatalog = roomAmenityIds.length
      ? await this.prisma.amenityCatalog.findMany({
          where: { id: { in: roomAmenityIds } },
          select: { id: true, name: true },
        })
      : [];
    const roomAmenityNames = new Map(
      roomAmenityCatalog.map((item) => [item.id, item.name]),
    );
    const rooms = hotel.rooms.map((room) => {
      const galleryItems = roomImages.get(room.id) ?? [];
      return {
        ...room,
        images: galleryItems,
        gallery: galleryItems,
        amenityLabels: room.amenities.map(
          (id) => roomAmenityNames.get(id) ?? id,
        ),
      };
    });
    const minRoom = [...rooms].sort((left, right) =>
      left.basePrice.comparedTo(right.basePrice),
    )[0];
    return {
      ...hotel,
      rooms,
      roomCount: rooms.length,
      minPricePerNight: minRoom?.basePrice.toString() ?? null,
      currency: minRoom?.currency ?? null,
      amenities: hotel.amenityLinks.map((link) => ({
        id: link.amenityId,
        name: link.amenity.name,
      })),
      gallery,
      coverImageUrl:
        gallery.find((image) => image.isCover)?.url ?? hotel.coverImageUrl,
    };
  }

  create(user: AuthenticatedUser, input: CreateHotelDto) {
    return this.prisma.hotel.create({
      data: {
        ...input,
        ownerId: user.id,
        status: HotelStatus.DRAFT,
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        addressLine: input.addressLine.trim(),
        city: input.city.trim(),
        province: input.province.trim(),
        amenities: input.amenities ?? [],
      },
    });
  }

  async update(id: string, user: AuthenticatedUser, input: UpdateHotelDto) {
    await this.authorization.assertHotelOwner(id, user);
    const existing = await this.prisma.hotel.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
      select: { status: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy khách sạn.');
    assertEditable(existing.status);
    const result = await this.prisma.hotel.updateMany({
      where: {
        id,
        ownerId: user.id,
        deletedAt: null,
        status: { in: [HotelStatus.DRAFT, HotelStatus.REJECTED] },
      },
      data: {
        ...input,
        profileVersion: { increment: 1 },
        name: input.name?.trim(),
        slug: input.slug?.trim().toLowerCase(),
        addressLine: input.addressLine?.trim(),
        city: input.city?.trim(),
        province: input.province?.trim(),
      },
    });
    if (!result.count)
      throw new ConflictException('Trạng thái khách sạn đã thay đổi.');
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    return hotel;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.authorization.assertHotelOwner(id, user);
    await this.prisma.$transaction(async (tx) => {
      const hotel = await tx.hotel.findFirst({
        where: { id, ownerId: user.id, deletedAt: null },
        select: { status: true, _count: { select: { bookings: true } } },
      });
      if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
      if (hotel.status !== HotelStatus.DRAFT || hotel._count.bookings > 0) {
        throw new ConflictException(
          'Chỉ có thể xóa bản nháp chưa có đặt phòng.',
        );
      }
      const result = await tx.hotel.updateMany({
        where: {
          id,
          ownerId: user.id,
          deletedAt: null,
          status: HotelStatus.DRAFT,
        },
        data: { deletedAt: new Date(), profileVersion: { increment: 1 } },
      });
      if (!result.count)
        throw new ConflictException('Trạng thái khách sạn đã thay đổi.');
    });
  }

  async listOwnerProfiles(user: AuthenticatedUser) {
    const records = await this.prisma.hotel.findMany({
      where: { ownerId: user.id, deletedAt: null },
      include: ownerProfileInclude,
      orderBy: { updatedAt: 'desc' },
    });
    const galleries = await this.media.listMetadata(
      records.map((record) => record.id),
    );
    const submissions = await this.prisma.hotelSubmission.findMany({
      where: { hotelId: { in: records.map((record) => record.id) } },
      select: {
        id: true,
        hotelId: true,
        version: true,
        status: true,
        reason: true,
        submittedAt: true,
        decidedAt: true,
      },
      orderBy: [{ version: 'desc' }, { submittedAt: 'desc' }],
    });
    const latest = new Map<string, (typeof submissions)[number]>();
    for (const submission of submissions) {
      if (!latest.has(submission.hotelId))
        latest.set(submission.hotelId, submission);
    }
    return records.map((record) =>
      ownerProfile(
        record,
        galleries.get(record.id) ?? [],
        latest.get(record.id),
      ),
    );
  }

  async getOwnerProfile(id: string, user: AuthenticatedUser) {
    await this.authorization.assertHotelOwner(id, user);
    const record = await this.prisma.hotel.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
      include: ownerProfileInclude,
    });
    if (!record) throw new NotFoundException('Không tìm thấy khách sạn.');
    const galleries = await this.media.listMetadata([record.id]);
    const latestSubmission = await this.prisma.hotelSubmission.findFirst({
      where: { hotelId: id },
      select: {
        id: true,
        version: true,
        status: true,
        reason: true,
        submittedAt: true,
        decidedAt: true,
      },
      orderBy: [{ version: 'desc' }, { submittedAt: 'desc' }],
    });
    const latestRestriction = await this.prisma.hotelRestrictionAudit.findFirst(
      {
        where: { hotelId: id, ownerId: user.id },
        select: {
          action: true,
          reason: true,
          createdAt: true,
          futureBookingCount: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    );
    return {
      ...ownerProfile(
        record,
        galleries.get(record.id) ?? [],
        latestSubmission ?? undefined,
      ),
      latestRestriction,
    };
  }

  async createOwnerDraft(
    user: AuthenticatedUser,
    input: CreateOwnerHotelDraftDto,
  ) {
    if (input.name.trim().length < 2)
      throw new BadRequestException('Tên chỗ ở cần ít nhất 2 ký tự.');
    const where = {
      ownerId: user.id,
      clientDraftId: input.clientDraftId,
    };
    const existing = await this.prisma.hotel.findFirst({
      where,
      include: ownerProfileInclude,
    });
    if (existing?.deletedAt)
      throw new ConflictException('Bản nháp này đã bị xóa.');
    if (existing) {
      const galleries = await this.media.listMetadata([existing.id]);
      return ownerProfile(existing, galleries.get(existing.id) ?? []);
    }
    try {
      const record = await this.prisma.hotel.create({
        data: {
          ownerId: user.id,
          clientDraftId: input.clientDraftId,
          name: input.name.trim(),
          accommodationType: input.accommodationType,
          description: input.description?.trim() || null,
          slug: `draft-${randomUUID()}`,
          status: HotelStatus.DRAFT,
        },
        include: ownerProfileInclude,
      });
      return ownerProfile(record, []);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.hotel.findFirst({
          where,
          include: ownerProfileInclude,
        });
        if (duplicate?.deletedAt)
          throw new ConflictException('Bản nháp này đã bị xóa.');
        if (duplicate) {
          const galleries = await this.media.listMetadata([duplicate.id]);
          return ownerProfile(duplicate, galleries.get(duplicate.id) ?? []);
        }
      }
      throw error;
    }
  }

  async updateApprovedRefundRules(
    id: string,
    user: AuthenticatedUser,
    input: UpdateApprovedRefundRulesDto,
  ) {
    await this.authorization.assertHotelOwner(id, user);
    if (input.refundRules.length && !parseRefundRules(input.refundRules))
      throw new BadRequestException(
        'Quy tắc hoàn tiền cần có mốc 0 giờ, không trùng mốc và tỷ lệ hoàn không giảm khi hủy sớm hơn.',
      );
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotel.updateMany({
        where: {
          id,
          ownerId: user.id,
          deletedAt: null,
          status: HotelStatus.APPROVED,
          profileVersion: input.expectedVersion,
        },
        data: { profileVersion: { increment: 1 } },
      });
      if (!updated.count)
        throw new ConflictException(
          'Hồ sơ đã thay đổi hoặc không ở trạng thái hoạt động. Hãy tải lại.',
        );
      await tx.hotelPolicy.upsert({
        where: { hotelId: id },
        create: {
          hotelId: id,
          refundRules: input.refundRules.length
            ? input.refundRules.map((rule) => ({
                minimumHoursBeforeCheckIn: rule.minimumHoursBeforeCheckIn,
                refundPercent: rule.refundPercent,
              }))
            : Prisma.JsonNull,
        },
        update: {
          refundRules: input.refundRules.length
            ? input.refundRules.map((rule) => ({
                minimumHoursBeforeCheckIn: rule.minimumHoursBeforeCheckIn,
                refundPercent: rule.refundPercent,
              }))
            : Prisma.JsonNull,
        },
      });
    });
    return this.getOwnerProfile(id, user);
  }

  async updateOwnerProfile(
    id: string,
    user: AuthenticatedUser,
    input: UpdateOwnerHotelProfileDto,
  ) {
    if (input.name !== undefined && input.name?.trim().length < 2)
      throw new BadRequestException('Tên chỗ ở cần ít nhất 2 ký tự.');
    await this.authorization.assertHotelOwner(id, user);
    const existing = await this.prisma.hotel.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
      select: { status: true, profileVersion: true },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy khách sạn.');
    assertEditable(existing.status);
    if (existing.profileVersion !== input.expectedVersion)
      throw new ConflictException(
        'Hồ sơ đã được cập nhật ở nơi khác. Hãy tải lại trước khi lưu.',
      );
    const { expectedVersion, policy, amenityIds, ...changes } = input;
    if (
      policy?.refundRules &&
      policy.refundRules.length &&
      !parseRefundRules(policy.refundRules)
    )
      throw new BadRequestException(
        'Quy tắc hoàn tiền cần có mốc 0 giờ, không trùng mốc và tỷ lệ hoàn không giảm khi hủy sớm hơn.',
      );
    if (!Object.keys(changes).length && !policy && !amenityIds)
      throw new ConflictException('Không có thay đổi nào để lưu.');
    if (amenityIds) {
      const allowed = await this.prisma.amenityCatalog.findMany({
        where: { id: { in: amenityIds }, active: true },
        select: { id: true },
      });
      const existingLinks = await this.prisma.hotelAmenity.findMany({
        where: { hotelId: id, amenityId: { in: amenityIds } },
        select: { amenityId: true },
      });
      const permitted = new Set([
        ...allowed.map((item) => item.id),
        ...existingLinks.map((item) => item.amenityId),
      ]);
      if (amenityIds.some((amenityId) => !permitted.has(amenityId)))
        throw new BadRequestException('Có tiện ích không nằm trong danh mục.');
    }
    const normalized = {
      ...changes,
      amenities: amenityIds,
      name: changes.name?.trim(),
      description:
        changes.description === undefined
          ? undefined
          : changes.description?.trim() || null,
      contactEmail:
        changes.contactEmail === undefined
          ? undefined
          : changes.contactEmail?.trim().toLowerCase() || null,
      contactPhone:
        changes.contactPhone === undefined
          ? undefined
          : changes.contactPhone?.trim() || null,
    };
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.hotel.updateMany({
        where: {
          id,
          ownerId: user.id,
          deletedAt: null,
          profileVersion: expectedVersion,
          status: { in: [HotelStatus.DRAFT, HotelStatus.REJECTED] },
        },
        data: { ...normalized, profileVersion: { increment: 1 } },
      });
      if (!result.count)
        throw new ConflictException(
          'Hồ sơ đã được cập nhật ở nơi khác. Hãy tải lại trước khi lưu.',
        );
      if (policy) {
        const updates = {
          cancellationPolicy:
            policy.cancellationPolicy === undefined
              ? undefined
              : policy.cancellationPolicy?.trim() || null,
          houseRules:
            policy.houseRules === undefined
              ? undefined
              : policy.houseRules?.trim() || null,
          refundRules:
            policy.refundRules === undefined
              ? undefined
              : policy.refundRules.length === 0
                ? Prisma.JsonNull
                : policy.refundRules.map((rule) => ({
                    minimumHoursBeforeCheckIn: rule.minimumHoursBeforeCheckIn,
                    refundPercent: rule.refundPercent,
                  })),
        };
        await tx.hotelPolicy.upsert({
          where: { hotelId: id },
          create: { hotelId: id, ...updates },
          update: updates,
        });
      }
      if (amenityIds) {
        await tx.hotelAmenity.deleteMany({ where: { hotelId: id } });
        if (amenityIds.length)
          await tx.hotelAmenity.createMany({
            data: amenityIds.map((amenityId) => ({ hotelId: id, amenityId })),
          });
      }
      const record = await tx.hotel.findFirst({
        where: { id, ownerId: user.id, deletedAt: null },
        include: ownerProfileInclude,
      });
      if (!record) throw new NotFoundException('Không tìm thấy khách sạn.');
      const galleries = await this.media.listMetadata([record.id]);
      const latestSubmission = await tx.hotelSubmission.findFirst({
        where: { hotelId: id },
        select: {
          id: true,
          version: true,
          status: true,
          reason: true,
          submittedAt: true,
          decidedAt: true,
        },
        orderBy: [{ version: 'desc' }, { submittedAt: 'desc' }],
      });
      return ownerProfile(
        record,
        galleries.get(record.id) ?? [],
        latestSubmission ?? undefined,
      );
    });
  }
}
