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
import { UpdateHotelDto } from './dto/update-hotel.dto';
import {
  CreateOwnerHotelDraftDto,
  UpdateOwnerHotelProfileDto,
} from './dto/owner-hotel-profile.dto';
import { HotelMediaService } from './hotel-media.service';
import { hotelSubmissionReadiness } from './hotel-submission-readiness';
import {
  inventoryRange,
  loadInventoryDays,
  minimumAvailable,
} from '../rooms/inventory';
import { resolveNightlyRates } from '../pricing/pricing.domain';

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

  async list(query: HotelQueryDto, user?: AuthenticatedUser) {
    if (Boolean(query.checkIn) !== Boolean(query.checkOut))
      throw new BadRequestException(
        'Cần cả ngày nhận và trả phòng để lọc chỗ ở.',
      );
    const stayDates =
      query.checkIn && query.checkOut
        ? inventoryRange(query.checkIn, query.checkOut)
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

    const search = query.search?.trim();
    const where: Prisma.HotelWhereInput = {
      id: nearbyIds ? { in: nearbyIds } : undefined,
      deletedAt: null,
      ownerId: ownerScope || canModerate ? query.ownerId : undefined,
      status: ownerScope || canModerate ? query.status : HotelStatus.APPROVED,
      isVisible: ownerScope || canModerate ? undefined : true,
      rooms:
        ownerScope || canModerate
          ? undefined
          : {
              some: { status: RoomStatus.ACTIVE, deletedAt: null },
            },
      AND: amenityIds.map((amenityId) => ({
        amenityLinks: { some: { amenityId } },
      })),
      city: query.city
        ? { equals: query.city.trim(), mode: 'insensitive' }
        : undefined,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { province: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    const records = await this.prisma.hotel.findMany({
      where,
      omit: { clientDraftId: true },
      include: {
        amenityLinks: {
          select: { amenityId: true, amenity: { select: { name: true } } },
        },
        rooms: {
          where: {
            deletedAt: null,
            status: RoomStatus.ACTIVE,
            quantity: { gt: 0 },
          },
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
          hotelId: { in: records.map((record) => record.id) },
          deletedAt: null,
          status: RoomStatus.ACTIVE,
          quantity: { gt: 0 },
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
      const rulesByRoom = new Map(
        candidates.map((room) => [
          room.id,
          allRules.filter((rule) => rule.roomId === room.id),
        ]),
      );
      for (let index = 0; index < candidates.length; index += 20) {
        const batch = candidates.slice(index, index + 20);
        const available = await Promise.all(
          batch.map(async (room) => ({
            room,
            count: minimumAvailable(
              await loadInventoryDays(
                this.prisma,
                room.id,
                room.quantity,
                stayDates,
              ),
            ),
          })),
        );
        for (const { room, count } of available) {
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
      const { rooms, _count, ...hotel } = record;
      return {
        ...hotel,
        roomCount: _count.rooms,
        minPricePerNight:
          (
            sellableByHotel.get(hotel.id)?.basePrice ?? rooms[0]?.basePrice
          )?.toString() ?? null,
        currency:
          sellableByHotel.get(hotel.id)?.currency ?? rooms[0]?.currency ?? null,
        amenities: hotel.amenityLinks.map((link) => ({
          id: link.amenityId,
          name: link.amenity.name,
        })),
        coverImageUrl:
          galleries.get(hotel.id)?.find((image) => image.isCover)?.url ??
          hotel.coverImageUrl,
      };
    });
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
