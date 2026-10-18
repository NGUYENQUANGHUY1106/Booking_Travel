import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelStatus, RoomStatus, UserRole } from '@prisma/client';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async listByHotel(hotelId: string, user?: AuthenticatedUser) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { ownerId: true, status: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    const isOwner =
      user?.role === UserRole.HOTEL_OWNER && hotel.ownerId === user.id;
    if (hotel.status !== HotelStatus.APPROVED && !isOwner) {
      throw new ForbiddenException('Không được xem phòng của khách sạn này.');
    }
    return this.prisma.room.findMany({
      where: {
        hotelId,
        deletedAt: null,
        status: isOwner ? undefined : RoomStatus.ACTIVE,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(id: string, user?: AuthenticatedUser) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null, hotel: { deletedAt: null } },
      include: {
        hotel: {
          select: { id: true, name: true, ownerId: true, status: true },
        },
      },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng.');
    const isOwner =
      user?.role === UserRole.HOTEL_OWNER && room.hotel.ownerId === user.id;
    if (
      !isOwner &&
      (room.hotel.status !== HotelStatus.APPROVED ||
        room.status !== RoomStatus.ACTIVE)
    ) {
      throw new ForbiddenException('Không được xem phòng này.');
    }
    return {
      ...room,
      hotel: {
        id: room.hotel.id,
        name: room.hotel.name,
        ownerId: room.hotel.ownerId,
      },
    };
  }

  async create(hotelId: string, user: AuthenticatedUser, input: CreateRoomDto) {
    await this.authorization.assertHotelOwner(hotelId, user);
    return this.prisma.room.create({
      data: {
        ...input,
        hotelId,
        name: input.name.trim(),
        type: input.type.trim().toUpperCase(),
        bedInfo: input.bedInfo.trim(),
        currency: input.currency?.trim().toUpperCase() ?? 'VND',
        amenities: input.amenities ?? [],
      },
    });
  }

  async update(id: string, user: AuthenticatedUser, input: UpdateRoomDto) {
    await this.authorization.assertRoomOwner(id, user);
    const result = await this.prisma.room.updateMany({
      where: {
        id,
        deletedAt: null,
        hotel: { ownerId: user.id, deletedAt: null },
      },
      data: {
        ...input,
        name: input.name?.trim(),
        type: input.type?.trim().toUpperCase(),
        bedInfo: input.bedInfo?.trim(),
        currency: input.currency?.trim().toUpperCase(),
      },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy phòng.');
    const room = await this.prisma.room.findFirst({
      where: {
        id,
        deletedAt: null,
        hotel: { ownerId: user.id, deletedAt: null },
      },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng.');
    return room;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.authorization.assertRoomOwner(id, user);
    const result = await this.prisma.room.updateMany({
      where: {
        id,
        deletedAt: null,
        hotel: { ownerId: user.id, deletedAt: null },
      },
      data: { deletedAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy phòng.');
  }
}
