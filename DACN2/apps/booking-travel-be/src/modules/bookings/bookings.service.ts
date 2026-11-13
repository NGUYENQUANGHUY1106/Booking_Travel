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
import { QuoteBookingDto } from './dto/quote-booking.dto';
import { PricingService } from '../pricing/pricing.service';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import {
  inventoryDate,
  loadInventoryDays,
  minimumAvailable,
  publicStayDates,
} from '../rooms/inventory';

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
    private readonly pricing: PricingService,
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

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        hotel: { select: { id: true, name: true, ownerId: true } },
        room: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return bookings.map((booking) => ({
      ...booking,
      room: {
        ...booking.room,
        name: booking.roomNameSnapshot,
        type: booking.roomTypeSnapshot,
      },
    }));
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
    return {
      ...booking,
      room: {
        ...booking.room,
        name: booking.roomNameSnapshot,
        type: booking.roomTypeSnapshot,
      },
    };
  }

  async create(userId: string, input: CreateBookingDto) {
    const dates = publicStayDates(input.checkIn, input.checkOut);
    const checkIn = dates[0];
    const checkOut = inventoryDate(input.checkOut);
    const nights = Math.round(
      (checkOut.getTime() - checkIn.getTime()) / MILLISECONDS_PER_DAY,
    );
    if (nights < 1) {
      throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng.');
    }

    return this.prisma.$transaction(
      async (transaction) => {
        // The hotel lock serializes new bookings with Admin hide/suspend decisions.
        // Always acquire it before the room lock to keep a consistent lock order.
        const hotelRows = await transaction.$queryRaw<{ hotelId: string }[]>`
          SELECT "hotelId" FROM "Room" WHERE "id" = ${input.roomId}
        `;
        if (!hotelRows[0]) throw new NotFoundException('Không tìm thấy phòng.');
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${hotelRows[0].hotelId}))`;
        await transaction.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${input.roomId}))`;
        const room = await transaction.room.findFirst({
          where: {
            id: input.roomId,
            deletedAt: null,
            status: RoomStatus.ACTIVE,
            hotel: {
              deletedAt: null,
              status: HotelStatus.APPROVED,
              isVisible: true,
            },
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
        if (
          input.adults > room.capacityAdults * roomCount ||
          (input.children ?? 0) > room.capacityChildren * roomCount
        )
          throw new BadRequestException(
            'Số khách vượt quá sức chứa của hạng phòng đã chọn.',
          );
        const days = await loadInventoryDays(
          transaction,
          room.id,
          room.quantity,
          dates,
        );
        if (minimumAvailable(days) < roomCount) {
          throw new ConflictException(
            'Không đủ số lượng phòng trong khoảng ngày đã chọn.',
          );
        }

        const rates = await this.pricing.loadRates(
          transaction,
          room.id,
          room.basePrice,
          dates,
        );
        const pricePerNight = rates[0].price;
        const totalAmount = rates
          .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
          .mul(roomCount);
        return transaction.booking.create({
          data: {
            code: `BT-${randomUUID().slice(0, 8).toUpperCase()}`,
            userId: user.id,
            hotelId: room.hotelId,
            roomId: room.id,
            roomNameSnapshot: room.name,
            roomTypeSnapshot: room.type,
            checkIn,
            checkOut,
            adults: input.adults,
            children: input.children ?? 0,
            roomCount,
            nights,
            pricePerNight,
            totalAmount,
            nightlyRatesSnapshot: rates.map((rate) => ({
              date: rate.date,
              price: rate.price.toString(),
              source: rate.source,
              ruleId: rate.ruleId,
            })),
            currency: room.currency,
            status: BookingStatus.CONFIRMED,
            guestName: input.guestName.trim(),
            guestEmail: input.guestEmail.trim().toLowerCase(),
            guestPhone: input.guestPhone?.trim(),
            note: input.note?.trim(),
          },
          include: {
            hotel: { select: { id: true, name: true, ownerId: true } },
            room: { select: { id: true, name: true, type: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async quote(input: QuoteBookingDto) {
    const dates = publicStayDates(input.checkIn, input.checkOut);
    const room = await this.prisma.room.findFirst({
      where: {
        id: input.roomId,
        deletedAt: null,
        status: RoomStatus.ACTIVE,
        hotel: {
          deletedAt: null,
          status: HotelStatus.APPROVED,
          isVisible: true,
        },
      },
    });
    if (!room) throw new NotFoundException('Hạng phòng không còn mở bán.');
    const roomCount = input.roomCount ?? 1;
    if (
      input.adults > room.capacityAdults * roomCount ||
      (input.children ?? 0) > room.capacityChildren * roomCount
    )
      throw new BadRequestException(
        'Số khách vượt quá sức chứa của hạng phòng.',
      );
    const inventory = await loadInventoryDays(
      this.prisma,
      room.id,
      room.quantity,
      dates,
    );
    if (minimumAvailable(inventory) < roomCount)
      throw new ConflictException(
        'Không đủ số phòng trống trong khoảng ngày đã chọn.',
      );
    const rates = await this.pricing.loadRates(
      this.prisma,
      room.id,
      room.basePrice,
      dates,
    );
    const totalAmount = rates
      .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
      .mul(roomCount);
    return {
      roomId: room.id,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: dates.length,
      roomCount,
      currency: room.currency,
      nightlyRates: rates,
      totalAmount,
    };
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
}
