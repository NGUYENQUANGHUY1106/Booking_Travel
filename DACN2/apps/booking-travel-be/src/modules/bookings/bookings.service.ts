import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BookingPaymentMethod,
  HotelStatus,
  Prisma,
  RoomStatus,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { BookingQuoteToken, policyFingerprint } from './booking-quote-token';
import { AuditService } from '../../common/authorization/audit.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QuoteBookingDto } from './dto/quote-booking.dto';
import { PricingService } from '../pricing/pricing.service';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { simulatorConfigured } from '../payments/simulator-signature';
import {
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
    private readonly quoteTokens: BookingQuoteToken = new BookingQuoteToken(),
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

  async create(user: AuthenticatedUser, input: CreateBookingDto) {
    if (
      input.paymentMethod === BookingPaymentMethod.SIMULATOR &&
      !simulatorConfigured()
    )
      throw new ConflictException({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'Cổng thanh toán mô phỏng chưa được bật.',
      });
    const claims = this.quoteTokens.verify(input.quoteId);
    if (
      claims.userId !== user.id ||
      claims.sessionId !== user.sessionId ||
      claims.roomId !== input.roomId ||
      claims.checkIn !== input.checkIn ||
      claims.checkOut !== input.checkOut ||
      claims.adults !== input.adults ||
      claims.children !== (input.children ?? 0) ||
      claims.roomCount !== (input.roomCount ?? 1)
    ) {
      throw new ConflictException({
        code: 'QUOTE_CONTEXT_MISMATCH',
        message: 'Thông tin đặt phòng đã thay đổi. Vui lòng lấy báo giá mới.',
      });
    }
    const dates = this.stayDates(input.checkIn, input.checkOut);
    const checkIn = dates[0];
    const checkOut = this.parseDate(input.checkOut);
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
        const existing = await transaction.booking.findUnique({
          where: { quoteId: claims.id },
        });
        if (existing) {
          if (
            existing.userId === user.id &&
            existing.paymentMethod ===
              (input.paymentMethod ?? BookingPaymentMethod.PAY_AT_HOTEL)
          )
            return existing;
          throw new ConflictException({
            code: 'QUOTE_CONTEXT_MISMATCH',
            message: 'Báo giá không thuộc tài khoản này.',
          });
        }
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
          include: { hotel: { include: { policy: true } } },
        });
        if (!room)
          throw new NotFoundException(
            'Phòng không tồn tại hoặc đang ngừng bán.',
          );

        const dbUser = await transaction.user.findFirst({
          where: { id: user.id, isActive: true },
          select: { id: true },
        });
        if (!dbUser)
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
          throw new ConflictException({
            code: 'ROOM_UNAVAILABLE',
            availableQty: minimumAvailable(days),
            message: 'Không đủ phòng trống. Vui lòng đổi ngày hoặc hạng phòng.',
          });
        }

        const rates = await this.pricing.loadRates(
          transaction,
          room.id,
          room.basePrice,
          dates,
        );
        if (
          rates.length !== dates.length ||
          rates.some((rate) => !rate.price.isFinite() || rate.price.lte(0))
        ) {
          throw new ConflictException({
            code: 'RATE_UNAVAILABLE',
            message: 'Chưa có giá hợp lệ cho toàn bộ kỳ lưu trú.',
          });
        }
        const pricePerNight = rates[0].price;
        const totalAmount = rates
          .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
          .mul(roomCount);
        if (
          room.hotelId !== claims.hotelId ||
          room.currency !== claims.currency ||
          totalAmount.toString() !== claims.totalAmount
        ) {
          throw new ConflictException({
            code: 'PRICE_CHANGED',
            message:
              'Giá phòng đã thay đổi. Vui lòng xem báo giá mới trước khi đặt.',
          });
        }
        if (
          policyFingerprint(room.hotel.policy?.cancellationPolicy ?? null) !==
          claims.cancellationPolicyHash
        ) {
          throw new ConflictException({
            code: 'POLICY_CHANGED',
            message: 'Chính sách hủy đã thay đổi. Vui lòng xem lại báo giá.',
          });
        }
        return transaction.booking.create({
          data: {
            quoteId: claims.id,
            code: `BT-${randomUUID().slice(0, 8).toUpperCase()}`,
            userId: dbUser.id,
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
            cancellationPolicySnapshot:
              room.hotel.policy?.cancellationPolicy ?? null,
            currency: room.currency,
            paymentMethod:
              input.paymentMethod ?? BookingPaymentMethod.PAY_AT_HOTEL,
            paymentDeadline:
              input.paymentMethod === BookingPaymentMethod.SIMULATOR
                ? new Date(Date.now() + 15 * 60 * 1000)
                : null,
            guestName: input.guestName.trim(),
            guestEmail: input.guestEmail.trim().toLowerCase(),
            guestPhone: input.guestPhone?.trim(),
            note: input.note?.trim(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async quote(input: QuoteBookingDto, user: AuthenticatedUser) {
    if (!user.sessionId)
      throw new ForbiddenException(
        'Cần phiên đăng nhập hợp lệ để lấy báo giá.',
      );
    if (input.voucherCode?.trim()) {
      throw new BadRequestException({
        code: 'VOUCHER_INVALID',
        message: 'Mã ưu đãi chưa được hỗ trợ cho đặt phòng này.',
      });
    }
    const dates = this.stayDates(input.checkIn, input.checkOut);
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
      include: { hotel: { include: { policy: true } } },
    });
    if (!room || (input.hotelId && input.hotelId !== room.hotelId))
      throw new NotFoundException({
        code: 'ROOM_NOT_PUBLIC',
        message: 'Hạng phòng không còn mở bán.',
      });
    const roomCount = input.roomCount ?? 1;
    if (
      input.adults > room.capacityAdults * roomCount ||
      (input.children ?? 0) > room.capacityChildren * roomCount
    )
      throw new BadRequestException({
        code: 'INVALID_GUESTS',
        message: 'Số khách vượt quá sức chứa của hạng phòng.',
      });
    const inventory = await loadInventoryDays(
      this.prisma,
      room.id,
      room.quantity,
      dates,
    );
    if (minimumAvailable(inventory) < roomCount)
      throw new ConflictException({
        code: 'ROOM_UNAVAILABLE',
        availableQty: minimumAvailable(inventory),
        message: 'Không đủ phòng trống. Vui lòng đổi ngày hoặc hạng phòng.',
      });
    const rates = await this.pricing.loadRates(
      this.prisma,
      room.id,
      room.basePrice,
      dates,
    );
    if (
      rates.length !== dates.length ||
      rates.some((rate) => !rate.price.isFinite() || rate.price.lte(0))
    ) {
      throw new ConflictException({
        code: 'RATE_UNAVAILABLE',
        message: 'Chưa có giá hợp lệ cho toàn bộ kỳ lưu trú.',
      });
    }
    const totalAmount = rates
      .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
      .mul(roomCount);
    const issued = this.quoteTokens.issue({
      userId: user.id,
      sessionId: user.sessionId,
      roomId: room.id,
      hotelId: room.hotelId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children ?? 0,
      roomCount,
      currency: room.currency,
      totalAmount: totalAmount.toString(),
      cancellationPolicyHash: policyFingerprint(
        room.hotel.policy?.cancellationPolicy ?? null,
      ),
    });
    return {
      ...issued,
      priceChanged: Boolean(
        input.expectedTotalAmount &&
        !totalAmount.equals(input.expectedTotalAmount),
      ),
      hotel: {
        id: room.hotel.id,
        name: room.hotel.name,
        coverImageUrl: room.hotel.coverImageUrl,
        checkInTime: room.hotel.checkInTime,
        checkOutTime: room.hotel.checkOutTime,
      },
      room: { id: room.id, name: room.name, type: room.type },
      roomId: room.id,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      nights: dates.length,
      roomCount,
      adults: input.adults,
      children: input.children ?? 0,
      currency: room.currency,
      nightlyRates: rates.map((rate) => ({
        date: rate.date,
        rate: rate.price.toString(),
        quantity: roomCount,
        amount: rate.price.mul(roomCount).toString(),
        source: rate.source,
      })),
      roomSubtotal: totalAmount.toString(),
      taxes: [],
      fees: [],
      discounts: [],
      finalAmount: totalAmount.toString(),
      totalAmount: totalAmount.toString(),
      cancellationPolicy: room.hotel.policy?.cancellationPolicy ?? null,
      paymentMethod: 'PAY_AT_HOTEL',
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

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Ngày nhận hoặc trả phòng không hợp lệ.');
    }
    return date;
  }

  private stayDates(checkIn: string, checkOut: string): Date[] {
    try {
      return publicStayDates(checkIn, checkOut);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw new BadRequestException({
          code: 'INVALID_DATES',
          message: 'Ngày nhận/trả phòng không hợp lệ hoặc đã qua.',
        });
      }
      throw error;
    }
  }
}
