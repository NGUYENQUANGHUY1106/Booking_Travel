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
import { HotelMediaService } from '../hotels/hotel-media.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { RoomAvailabilityQueryDto } from './dto/room-availability-query.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { ROOM_BED_TYPES, ROOM_CLASSES, ROOM_VIEWS } from './room-catalog';

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
    private readonly media: HotelMediaService,
  ) {}

  private async publicRoomData<
    TRoom extends {
      id: string;
      amenities: string[];
      classCode: string | null;
      viewCode: string | null;
    },
  >(hotelId: string, rooms: TRoom[]) {
    const [galleries, amenities] = await Promise.all([
      this.media.listPublicRoomMetadata(
        hotelId,
        rooms.map((room) => room.id),
      ),
      this.prisma.amenityCatalog.findMany({
        where: {
          id: { in: [...new Set(rooms.flatMap((room) => room.amenities))] },
          active: true,
        },
        select: { id: true, name: true },
      }),
    ]);
    const amenityNames = new Map(amenities.map((item) => [item.id, item.name]));
    return rooms.map((room) => ({
      ...room,
      classLabel:
        ROOM_CLASSES.find((item) => item.code === room.classCode)?.label ??
        null,
      viewLabel:
        ROOM_VIEWS.find((item) => item.code === room.viewCode)?.label ?? null,
      amenityDetails: room.amenities.map((id) => ({
        id,
        name: amenityNames.get(id) ?? id,
      })),
      gallery: galleries.get(room.id) ?? [],
      images: galleries.get(room.id) ?? [],
    }));
  }

  async listByHotel(hotelId: string, user?: AuthenticatedUser) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { ownerId: true, status: true, isVisible: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    const isOwner =
      user?.role === UserRole.HOTEL_OWNER && hotel.ownerId === user.id;
    if (
      (hotel.status !== HotelStatus.APPROVED || !hotel.isVisible) &&
      !isOwner
    ) {
      throw new ForbiddenException('Không được xem phòng của khách sạn này.');
    }
    const rooms = await this.prisma.room.findMany({
      where: {
        hotelId,
        deletedAt: null,
        status: isOwner ? undefined : RoomStatus.ACTIVE,
        quantity: isOwner ? undefined : { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!isOwner) return this.publicRoomData(hotelId, rooms);
    const images = await this.media.listRoomMetadataForRooms(
      rooms.map((room) => room.id),
      'private',
    );
    return rooms.map((room) => ({
      ...room,
      images: images.get(room.id) ?? [],
      gallery: images.get(room.id) ?? [],
    }));
  }

  async get(id: string, user?: AuthenticatedUser) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null, hotel: { deletedAt: null } },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            addressLine: true,
            city: true,
            province: true,
            district: true,
            ward: true,
            checkInTime: true,
            checkOutTime: true,
            coverImageUrl: true,
            starRating: true,
            ownerId: true,
            status: true,
            isVisible: true,
            policy: true,
          },
        },
      },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng.');
    const isOwner =
      user?.role === UserRole.HOTEL_OWNER && room.hotel.ownerId === user.id;
    if (
      !isOwner &&
      (room.hotel.status !== HotelStatus.APPROVED ||
        !room.hotel.isVisible ||
        room.status !== RoomStatus.ACTIVE)
    ) {
      throw new ForbiddenException('Không được xem phòng này.');
    }
    if (isOwner) {
      const images = await this.media.listRoomMetadataForRooms(
        [room.id],
        'private',
      );
      return {
        ...room,
        images: images.get(room.id) ?? [],
        gallery: images.get(room.id) ?? [],
      };
    }
    const [result] = await this.publicRoomData(room.hotelId, [room]);
    return {
      ...result,
      hotel: {
        id: room.hotel.id,
        name: room.hotel.name,
        addressLine: room.hotel.addressLine,
        city: room.hotel.city,
        province: room.hotel.province,
        district: room.hotel.district,
        ward: room.hotel.ward,
        checkInTime: room.hotel.checkInTime,
        checkOutTime: room.hotel.checkOutTime,
        coverImageUrl: room.hotel.coverImageUrl,
        starRating: room.hotel.starRating,
        policy: room.hotel.policy,
      },
    };
  }

  async availability(id: string, query: RoomAvailabilityQueryDto) {
    const parse = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        throw new BadRequestException('Ngày lưu trú phải có dạng YYYY-MM-DD.');
      const date = new Date(`${value}T00:00:00.000Z`);
      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        throw new BadRequestException('Ngày lưu trú không hợp lệ.');
      return date;
    };
    const checkIn = parse(query.checkIn);
    const checkOut = parse(query.checkOut);
    if (checkOut <= checkIn)
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng.');
    const room = await this.prisma.room.findFirst({
      where: {
        id,
        deletedAt: null,
        status: RoomStatus.ACTIVE,
        hotel: {
          deletedAt: null,
          status: HotelStatus.APPROVED,
          isVisible: true,
        },
      },
      select: { id: true, quantity: true, basePrice: true, currency: true },
    });
    if (!room) throw new NotFoundException('Hạng phòng không còn mở bán.');
    const bookings = await this.prisma.booking.findMany({
      where: {
        roomId: id,
        status: { in: ACTIVE_BOOKING_STATUSES },
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
      select: { checkIn: true, checkOut: true, roomCount: true },
    });
    const events = bookings
      .flatMap(({ checkIn: start, checkOut: end, roomCount }) => [
        { at: Math.max(start.getTime(), checkIn.getTime()), delta: roomCount },
        { at: Math.min(end.getTime(), checkOut.getTime()), delta: -roomCount },
      ])
      .sort((a, b) => a.at - b.at || a.delta - b.delta);
    let occupied = 0;
    let peak = 0;
    for (const event of events) {
      occupied += event.delta;
      peak = Math.max(peak, occupied);
    }
    return {
      roomId: id,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      totalRooms: room.quantity,
      availableRooms: Math.max(0, room.quantity - peak),
      basePrice: room.basePrice,
      currency: room.currency,
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
    const { expectedRevision, ...changes } = input;
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
      const current = await tx.room.findFirst({
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
      if (!current || current.revision !== expectedRevision)
        throw new ConflictException(
          'Hạng phòng đã thay đổi. Vui lòng tải lại trước khi lưu.',
        );
      if (changes.quantity !== undefined)
        await assertRoomQuantity(tx, id, changes.quantity);
      const type = changes.type?.trim().toUpperCase();
      if (type && !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(type))
        throw new BadRequestException(
          'Mã loại phòng chỉ gồm chữ, số và dấu gạch nối.',
        );
      if (type && type !== current.type) {
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
      if (changes.bedConfigurations && !changes.bedConfigurations.length)
        throw new BadRequestException('Chọn ít nhất một loại giường.');
      if (
        (changes.classCode ||
          changes.viewCode ||
          changes.bedConfigurations ||
          current.classCode) &&
        (!(changes.classCode ?? current.classCode) ||
          !(changes.viewCode ?? current.viewCode) ||
          !(
            changes.bedConfigurations ??
            (Array.isArray(current.bedConfigurations)
              ? current.bedConfigurations
              : null)
          )?.length)
      )
        throw new BadRequestException(
          'Cấu hình hạng phòng cần đủ hạng, hướng nhìn và giường.',
        );
      if (changes.currency && changes.currency.toUpperCase() !== 'VND')
        throw new BadRequestException('Hiện chỉ hỗ trợ giá cơ bản bằng VND.');
      await assertAmenities(tx, changes.amenities);
      const updated = await tx.room.update({
        where: { id },
        data: {
          ...changes,
          revision: { increment: 1 },
          name: changes.name?.trim(),
          type,
          bedInfo: changes.bedConfigurations?.length
            ? bedSummary(changes.bedConfigurations)
            : current.bedConfigurations
              ? undefined
              : changes.bedInfo?.trim(),
          bedConfigurations: changes.bedConfigurations?.map(
            ({ bedType, quantity }) => ({ bedType, quantity }),
          ),
          currency: changes.currency?.toUpperCase(),
        },
      });
      await tx.hotel.update({
        where: { id: room.hotelId },
        data: { profileVersion: { increment: 1 } },
      });
      return updated;
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
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${room.hotelId}))`;
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${id}))`;
      const editable = await tx.hotel.findFirst({
        where: {
          id: room.hotelId,
          ownerId: user.id,
          deletedAt: null,
          status: { notIn: [HotelStatus.PENDING, HotelStatus.SUSPENDED] },
        },
        select: { id: true },
      });
      if (!editable)
        throw new ConflictException('Trạng thái khách sạn đã thay đổi.');
      await assertRoomQuantity(tx, id, 0);
      await tx.room.update({ where: { id }, data: { deletedAt: new Date() } });
      await tx.hotel.update({
        where: { id: room.hotelId },
        data: { profileVersion: { increment: 1 } },
      });
    });
  }
}
