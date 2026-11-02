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

const ownerProfileInclude = {
  policy: true,
  _count: { select: { rooms: { where: { deletedAt: null } }, bookings: true } },
} as const;

type OwnerProfileRecord = Prisma.HotelGetPayload<{
  include: typeof ownerProfileInclude;
}>;

function ownerProfile(record: OwnerProfileRecord) {
  const { _count, ...hotel } = record;
  const completion = {
    basic: Boolean(hotel.name.trim() && hotel.accommodationType),
    contact:
      Boolean(hotel.contactEmail || hotel.contactPhone) &&
      Boolean(hotel.checkInTime && hotel.checkOutTime),
    location: Boolean(hotel.addressLine && hotel.city && hotel.province),
    media: Boolean(hotel.coverImageUrl),
    policy: Boolean(
      hotel.policy?.cancellationPolicy || hotel.policy?.houseRules,
    ),
    rooms: _count.rooms > 0,
  };
  return {
    ...hotel,
    roomCount: _count.rooms,
    bookingCount: _count.bookings,
    completion,
    readyForReview: Object.values(completion).every(Boolean),
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
  ) {}

  list(query: HotelQueryDto, user?: AuthenticatedUser) {
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

    const search = query.search?.trim();
    const where: Prisma.HotelWhereInput = {
      deletedAt: null,
      ownerId: ownerScope || canModerate ? query.ownerId : undefined,
      status: ownerScope || canModerate ? query.status : HotelStatus.APPROVED,
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

    return this.prisma.hotel.findMany({
      where,
      omit: { clientDraftId: true },
      include: {
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
  }

  async get(id: string, user?: AuthenticatedUser) {
    const scope = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
      select: { ownerId: true, status: true },
    });
    if (!scope) throw new NotFoundException('Không tìm thấy khách sạn.');
    const isOwner =
      user?.role === UserRole.HOTEL_OWNER && scope.ownerId === user.id;
    const canModerate =
      user?.role === UserRole.ADMIN &&
      user.permissions.includes('HOTEL_REVIEW');
    if (scope.status !== HotelStatus.APPROVED && !isOwner && !canModerate) {
      throw new ForbiddenException('Không được xem khách sạn chưa công khai.');
    }

    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id,
        deletedAt: null,
        ownerId: isOwner ? user?.id : undefined,
        status: isOwner || canModerate ? undefined : HotelStatus.APPROVED,
      },
      include: {
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
    return hotel;
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
    return records.map(ownerProfile);
  }

  async getOwnerProfile(id: string, user: AuthenticatedUser) {
    await this.authorization.assertHotelOwner(id, user);
    const record = await this.prisma.hotel.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
      include: ownerProfileInclude,
    });
    if (!record) throw new NotFoundException('Không tìm thấy khách sạn.');
    return ownerProfile(record);
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
    if (existing) return ownerProfile(existing);
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
      return ownerProfile(record);
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
        if (duplicate) return ownerProfile(duplicate);
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
    const { expectedVersion, policy, ...changes } = input;
    if (!Object.keys(changes).length && !policy)
      throw new ConflictException('Không có thay đổi nào để lưu.');
    const normalized = {
      ...changes,
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
      const record = await tx.hotel.findFirst({
        where: { id, ownerId: user.id, deletedAt: null },
        include: ownerProfileInclude,
      });
      if (!record) throw new NotFoundException('Không tìm thấy khách sạn.');
      return ownerProfile(record);
    });
  }
}
