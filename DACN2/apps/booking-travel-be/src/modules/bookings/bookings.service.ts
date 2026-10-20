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
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../common/authorization/audit.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';

const ACTIVE_INVENTORY_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING_PAYMENT,
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];
const MILLISECONDS_PER_DAY = 86_400_000;
const MANUAL_BOOKING_TRANSITIONS: Partial<
  Record<BookingStatus, BookingStatus>
> = {
  [BookingStatus.CONFIRMED]: BookingStatus.CHECKED_IN,
  [BookingStatus.CHECKED_IN]: BookingStatus.COMPLETED,
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async list(query: BookingQueryDto, user: AuthenticatedUser) {
    let where: Prisma.BookingWhereInput;
    if (user.role === UserRole.USER) {
      if (query.userId && query.userId !== user.id) {
        throw new ForbiddenException('Không được xem booking của người khác.');
      }
      where = { userId: user.id, hotelId: query.hotelId, status: query.status };
    } else if (user.role === UserRole.HOTEL_OWNER) {
      if (query.userId === user.id) {
        where = {
          userId: user.id,
          hotelId: query.hotelId,
          status: query.status,
        };
      } else {
        if (query.hotelId)
          await this.authorization.assertHotelOwner(query.hotelId, user);
        where = {
          hotel: { ownerId: user.id },
          hotelId: query.hotelId,
          userId: query.userId,
          status: query.status,
        };
      }
    } else if (
      user.role === UserRole.ADMIN &&
      user.permissions.includes('BOOKING_SUPPORT')
    ) {
      where = {
        userId: query.userId,
        hotelId: query.hotelId,
        status: query.status,
      };
    } else {
      throw new ForbiddenException('Bạn không có quyền xem danh sách booking.');
    }

    return this.prisma.booking.findMany({
      where,
      include: {
        hotel: { select: { id: true, name: true, ownerId: true } },
        room: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, user: AuthenticatedUser) {
    await this.authorization.assertBookingAccess(id, user, 'read');
    const where: Prisma.BookingWhereInput =
      user.role === UserRole.ADMIN
        ? { id }
        : user.role === UserRole.HOTEL_OWNER
          ? { id, OR: [{ userId: user.id }, { hotel: { ownerId: user.id } }] }
          : { id, userId: user.id };
    const booking = await this.prisma.booking.findFirst({
      where,
      include: {
        hotel: true,
        room: true,
        user: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');
    return booking;
  }

  async create(userId: string, input: CreateBookingDto) {
    const checkIn = this.parseDate(input.checkIn);
    const checkOut = this.parseDate(input.checkOut);
    const nights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / MILLISECONDS_PER_DAY,
    );
    if (nights < 1) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng.');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const room = await transaction.room.findFirst({
          where: {
            id: input.roomId,
            deletedAt: null,
            status: RoomStatus.ACTIVE,
            hotel: { deletedAt: null, status: HotelStatus.APPROVED },
          },
          include: { hotel: true },
        });
        if (!room)
          throw new NotFoundException(
            'Phòng không tồn tại hoặc đang ngừng bán.',
          );

        const user = await transaction.user.findFirst({
          where: { id: userId, isActive: true },
          select: { id: true },
        });
        if (!user)
          throw new NotFoundException('Không tìm thấy người đặt phòng.');

        const roomCount = input.roomCount ?? 1;
        const reserved = await transaction.booking.aggregate({
          where: {
            roomId: room.id,
            status: { in: ACTIVE_INVENTORY_STATUSES },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
          _sum: { roomCount: true },
        });
        if ((reserved._sum.roomCount ?? 0) + roomCount > room.quantity) {
          throw new ConflictException(
            'Không đủ số lượng phòng trong khoảng ngày đã chọn.',
          );
        }

        const pricePerNight = room.basePrice;
        const totalAmount = pricePerNight.mul(nights).mul(roomCount);
        return transaction.booking.create({
          data: {
            code: `BT-${randomUUID().slice(0, 8).toUpperCase()}`,
            userId: user.id,
            hotelId: room.hotelId,
            roomId: room.id,
            checkIn,
            checkOut,
            adults: input.adults,
            children: input.children ?? 0,
            roomCount,
            nights,
            pricePerNight,
            totalAmount,
            currency: room.currency,
            guestName: input.guestName.trim(),
            guestEmail: input.guestEmail.trim().toLowerCase(),
            guestPhone: input.guestPhone?.trim(),
            note: input.note?.trim(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateStatus(
    id: string,
    user: AuthenticatedUser,
    input: UpdateBookingStatusDto,
  ) {
    await this.authorization.assertBookingAccess(id, user, 'manage');
    if (
      input.status !== BookingStatus.CHECKED_IN &&
      input.status !== BookingStatus.COMPLETED
    ) {
      throw new ForbiddenException(
        'Endpoint này chỉ cho phép xác nhận nhận hoặc trả phòng.',
      );
    }

    const current = await this.prisma.booking.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!current) throw new NotFoundException('Không tìm thấy booking.');
    if (MANUAL_BOOKING_TRANSITIONS[current.status] !== input.status) {
      throw new ConflictException('Chuyển trạng thái booking không hợp lệ.');
    }

    const result = await this.prisma.booking.updateMany({
      where: {
        id,
        status: current.status,
        hotel:
          user.role === UserRole.HOTEL_OWNER ? { ownerId: user.id } : undefined,
      },
      data: { status: input.status },
    });
    if (!result.count) {
      throw new ConflictException('Trạng thái booking đã thay đổi.');
    }

    const booking = await this.prisma.booking.findFirst({
      where: {
        id,
        hotel:
          user.role === UserRole.HOTEL_OWNER ? { ownerId: user.id } : undefined,
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');
    if (user.role === UserRole.ADMIN) {
      this.audit.recordSuccess(user, 'BOOKING_STATUS_UPDATE', 'BOOKING', id);
    }
    return booking;
  }

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Ngày nhận hoặc trả phòng không hợp lệ.');
    }
    return date;
  }
}
