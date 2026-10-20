import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelStatus, Prisma, RoomStatus, UserRole } from '@prisma/client';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { HotelQueryDto } from './dto/hotel-query.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';

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
    const result = await this.prisma.hotel.updateMany({
      where: { id, ownerId: user.id, deletedAt: null },
      data: {
        ...input,
        name: input.name?.trim(),
        slug: input.slug?.trim().toLowerCase(),
        addressLine: input.addressLine?.trim(),
        city: input.city?.trim(),
        province: input.province?.trim(),
      },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy khách sạn.');
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, ownerId: user.id, deletedAt: null },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    return hotel;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.authorization.assertHotelOwner(id, user);
    const result = await this.prisma.hotel.updateMany({
      where: { id, ownerId: user.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy khách sạn.');
  }
}
