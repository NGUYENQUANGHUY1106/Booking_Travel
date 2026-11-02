import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  HotelStatus,
  Prisma,
  RoomStatus,
  UserRole,
} from '@prisma/client';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ROOM_BED_TYPES } from './room-catalog';

const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

function bedSummary(configurations: { bedType: string; quantity: number }[]) {
  return configurations
    .map(({ bedType, quantity }) => {
      const bed = ROOM_BED_TYPES.find((item) => item.code === bedType);
      return `${quantity} ${bed?.label ?? bedType}`;
    })
    .join(' · ');
}

async function assertRoomQuantity(
  tx: Prisma.TransactionClient,
  roomId: string,
  quantity: number,
) {
  const bookings = await tx.booking.findMany({
    where: {
      roomId,
      status: { in: ACTIVE_BOOKING_STATUSES },
      checkOut: { gt: new Date() },
    },
    select: { checkIn: true, checkOut: true, roomCount: true },
  });
  const changes = bookings
    .flatMap(({ checkIn, checkOut, roomCount }) => [
      { at: checkIn.getTime(), delta: roomCount },
      { at: checkOut.getTime(), delta: -roomCount },
    ])
    .sort((a, b) => a.at - b.at || a.delta - b.delta);
  let occupied = 0;
  for (const change of changes) {
    occupied += change.delta;
    if (occupied > quantity)
      throw new ConflictException(
        'Số phòng mới thấp hơn số phòng đã được đặt trong một ngày.',
      );
  }
}

async function assertAmenities(tx: Prisma.TransactionClient, ids?: string[]) {
  if (!ids?.length) return;
  const found = await tx.amenityCatalog.count({
    where: { id: { in: ids }, active: true },
  });
  if (found !== ids.length)
    throw new BadRequestException(
      'Có tiện ích phòng không thuộc danh mục đang hoạt động.',
    );
}

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
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, ownerId: user.id, deletedAt: null },
      select: { status: true },
    });
    if (
      !hotel ||
      hotel.status === HotelStatus.PENDING ||
      hotel.status === HotelStatus.SUSPENDED
    ) {
      throw new ConflictException(
        'Trạng thái khách sạn chưa cho phép thêm hạng phòng.',
      );
    }
    const type = input.type.trim().toUpperCase();
    if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(type))
      throw new BadRequestException(
        'Mã loại phòng chỉ gồm chữ, số và dấu gạch nối.',
      );
    if (input.bedConfigurations && !input.bedConfigurations.length)
      throw new BadRequestException('Chọn ít nhất một loại giường.');
    if (
      (input.classCode || input.viewCode || input.bedConfigurations) &&
      (!input.classCode || !input.viewCode || !input.bedConfigurations?.length)
    )
      throw new BadRequestException(
        'Cấu hình hạng phòng cần đủ hạng, hướng nhìn và giường.',
      );
    if (input.currency && input.currency.toUpperCase() !== 'VND')
      throw new BadRequestException('Hiện chỉ hỗ trợ giá cơ bản bằng VND.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${hotelId}))`;
      const duplicate = await tx.room.findFirst({
        where: {
          hotelId,
          type: { equals: type, mode: 'insensitive' },
          deletedAt: null,
        },
        select: { id: true },
      });
      if (duplicate)
        throw new ConflictException(
          'Mã loại phòng đã tồn tại trong chỗ ở này. Hãy chọn mã khác.',
        );
      await assertAmenities(tx, input.amenities);
      return tx.room.create({
        data: {
          ...input,
          hotelId,
          name: input.name.trim(),
          type,
          bedInfo: input.bedConfigurations?.length
            ? bedSummary(input.bedConfigurations)
            : input.bedInfo.trim(),
          bedConfigurations:
            input.bedConfigurations?.map(({ bedType, quantity }) => ({
              bedType,
              quantity,
            })) ?? Prisma.DbNull,
          currency: 'VND',
          amenities: input.amenities ?? [],
        },
      });
    });
  }

  async update(id: string, user: AuthenticatedUser, input: UpdateRoomDto) {
    await this.authorization.assertRoomOwner(id, user);
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: {
          id,
          deletedAt: null,
          hotel: {
            ownerId: user.id,
            deletedAt: null,
            status: { notIn: [HotelStatus.PENDING, HotelStatus.SUSPENDED] },
          },
        },
      });
      if (!room)
        throw new ConflictException(
          'Trạng thái khách sạn chưa cho phép sửa phòng.',
        );
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${room.hotelId}))`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${room.id}))`;
      if (input.quantity !== undefined)
        await assertRoomQuantity(tx, id, input.quantity);
      if (input.status && input.status !== RoomStatus.ACTIVE)
        await assertRoomQuantity(tx, id, 0);
      const type = input.type?.trim().toUpperCase();
      if (type && !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(type))
        throw new BadRequestException(
          'Mã loại phòng chỉ gồm chữ, số và dấu gạch nối.',
        );
      if (type && type !== room.type) {
        const duplicate = await tx.room.findFirst({
          where: {
            hotelId: room.hotelId,
            type: { equals: type, mode: 'insensitive' },
            deletedAt: null,
            id: { not: id },
          },
          select: { id: true },
        });
        if (duplicate)
          throw new ConflictException(
            'Mã loại phòng đã tồn tại trong chỗ ở này. Hãy chọn mã khác.',
          );
      }
      if (input.bedConfigurations && !input.bedConfigurations.length)
        throw new BadRequestException('Chọn ít nhất một loại giường.');
      if (
        (input.classCode ||
          input.viewCode ||
          input.bedConfigurations ||
          room.classCode) &&
        (!(input.classCode ?? room.classCode) ||
          !(input.viewCode ?? room.viewCode) ||
          !(
            input.bedConfigurations ??
            (Array.isArray(room.bedConfigurations)
              ? room.bedConfigurations
              : null)
          )?.length)
      )
        throw new BadRequestException(
          'Cấu hình hạng phòng cần đủ hạng, hướng nhìn và giường.',
        );
      if (input.currency && input.currency.toUpperCase() !== 'VND')
        throw new BadRequestException('Hiện chỉ hỗ trợ giá cơ bản bằng VND.');
      await assertAmenities(tx, input.amenities);
      return tx.room.update({
        where: { id },
        data: {
          ...input,
          name: input.name?.trim(),
          type,
          bedInfo: input.bedConfigurations?.length
            ? bedSummary(input.bedConfigurations)
            : room.bedConfigurations
              ? undefined
              : input.bedInfo?.trim(),
          bedConfigurations: input.bedConfigurations?.map(
            ({ bedType, quantity }) => ({ bedType, quantity }),
          ),
          currency: input.currency?.toUpperCase(),
        },
      });
    });
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.authorization.assertRoomOwner(id, user);
    await this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: {
          id,
          deletedAt: null,
          hotel: {
            ownerId: user.id,
            deletedAt: null,
            status: { notIn: [HotelStatus.PENDING, HotelStatus.SUSPENDED] },
          },
        },
        select: { hotelId: true },
      });
      if (!room)
        throw new ConflictException(
          'Trạng thái khách sạn chưa cho phép xóa phòng.',
        );
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${id}))`;
      await assertRoomQuantity(tx, id, 0);
      await tx.room.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }
}
