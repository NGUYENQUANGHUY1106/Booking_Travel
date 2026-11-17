import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingPaymentMethod,
  BookingStatus,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { AuditService } from '../../common/authorization/audit.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OwnerBookingNoteDto } from './dto/owner-booking-note.dto';
import {
  OwnerBookingQueryDto,
  OwnerBookingTab,
} from './dto/owner-booking-query.dto';

const OWNER_BOOKING_LIST_SELECT = {
  id: true,
  code: true,
  hotelId: true,
  roomId: true,
  hotel: { select: { name: true } },
  roomNameSnapshot: true,
  roomTypeSnapshot: true,
  checkIn: true,
  checkOut: true,
  adults: true,
  children: true,
  roomCount: true,
  nights: true,
  totalAmount: true,
  currency: true,
  status: true,
  paymentMethod: true,
  createdAt: true,
  payments: {
    select: { status: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.BookingSelect;

const OWNER_BOOKING_DETAIL_SELECT = {
  ...OWNER_BOOKING_LIST_SELECT,
  pricePerNight: true,
  paymentDeadline: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  note: true,
  cancellationPolicySnapshot: true,
  nightlyRatesSnapshot: true,
  cancelledAt: true,
  updatedAt: true,
  ownerInternalNote: true,
  ownerNoteUpdatedAt: true,
  ownerNoteUpdatedBy: true,
} satisfies Prisma.BookingSelect;

type OwnerBookingRecord = Prisma.BookingGetPayload<{
  select: typeof OWNER_BOOKING_LIST_SELECT;
}>;

@Injectable()
export class OwnerBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthenticatedUser, query: OwnerBookingQueryDto) {
    this.assertOwner(user);
    if (query.hotelId) {
      const ownedHotel = await this.prisma.hotel.findFirst({
        where: { id: query.hotelId, ownerId: user.id },
        select: { id: true },
      });
      if (!ownedHotel) throw new NotFoundException('Không tìm thấy chỗ ở.');
    }

    const from = this.parseDate(query.checkInFrom);
    const to = this.parseDate(query.checkInTo);
    if (from && to && from > to) {
      throw new BadRequestException(
        'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
      );
    }

    const now = new Date();
    const today = new Date(
      new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10),
    );
    const todayStartUtc = new Date(
      `${today.toISOString().slice(0, 10)}T00:00:00+07:00`,
    );
    const clauses: Prisma.BookingWhereInput[] = [
      { hotel: { ownerId: user.id } },
    ];
    if (query.hotelId) clauses.push({ hotelId: query.hotelId });
    if (query.status) clauses.push({ status: query.status });
    if (from || to)
      clauses.push({
        checkIn: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) },
      });
    const search = query.search?.trim();
    if (search)
      clauses.push({
        OR: [
          { code: { contains: search, mode: 'insensitive' } },
          { guestName: { contains: search, mode: 'insensitive' } },
          { guestEmail: { contains: search, mode: 'insensitive' } },
        ],
      });
    switch (query.tab) {
      case OwnerBookingTab.NEW:
        clauses.push({
          createdAt: {
            gte: todayStartUtc,
            lt: new Date(todayStartUtc.getTime() + 86_400_000),
          },
        });
        break;
      case OwnerBookingTab.UPCOMING:
        clauses.push({
          status: BookingStatus.CONFIRMED,
          checkIn: { gte: today },
        });
        break;
      case OwnerBookingTab.CHECKED_IN:
        clauses.push({ status: BookingStatus.CHECKED_IN });
        break;
      case OwnerBookingTab.COMPLETED:
        clauses.push({ status: BookingStatus.COMPLETED });
        break;
      case OwnerBookingTab.CANCELLED:
        clauses.push({
          status: {
            in: [
              BookingStatus.CANCELLED,
              BookingStatus.EXPIRED,
              BookingStatus.REFUND_PENDING,
              BookingStatus.REFUNDED,
            ],
          },
        });
        break;
    }

    const where: Prisma.BookingWhereInput = { AND: clauses };
    const cursor = this.parseCursor(query.after);
    const pageWhere: Prisma.BookingWhereInput = cursor
      ? {
          AND: [
            ...clauses,
            {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            },
          ],
        }
      : where;
    const limit = query.limit ?? 20;
    const [total, bookings] = await this.prisma.$transaction([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where: pageWhere,
        select: OWNER_BOOKING_LIST_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
    ]);
    const pageItems = bookings.slice(0, limit);
    const last = pageItems[pageItems.length - 1];
    return {
      items: pageItems.map((booking) => this.summary(booking)),
      total,
      limit,
      nextCursor:
        bookings.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                createdAt: last.createdAt.toISOString(),
                id: last.id,
              }),
            ).toString('base64url')
          : null,
    };
  }

  async detail(user: AuthenticatedUser, id: string) {
    this.assertOwner(user);
    const booking = await this.prisma.booking.findFirst({
      where: { id, hotel: { ownerId: user.id } },
      select: OWNER_BOOKING_DETAIL_SELECT,
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');
    return {
      ...this.summary(booking),
      guest: {
        name: booking.guestName,
        email: booking.guestEmail,
        phone: booking.guestPhone,
      },
      pricePerNight: booking.pricePerNight.toString(),
      nightlyRatesSnapshot: booking.nightlyRatesSnapshot,
      specialRequest: booking.note,
      cancellationPolicy: booking.cancellationPolicySnapshot,
      paymentMethod: booking.paymentMethod,
      paymentDeadline: booking.paymentDeadline,
      cancelledAt: booking.cancelledAt,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      internalNote: booking.ownerInternalNote,
      internalNoteUpdatedAt: booking.ownerNoteUpdatedAt,
      internalNoteUpdatedBy: booking.ownerNoteUpdatedBy,
    };
  }

  async updateNote(
    user: AuthenticatedUser,
    id: string,
    input: OwnerBookingNoteDto,
  ) {
    this.assertOwner(user);
    const note = [...input.note.trim()]
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code === 9 || code === 10 || (code >= 32 && code !== 127);
      })
      .join('');
    const result = await this.prisma.booking.updateMany({
      where: { id, hotel: { ownerId: user.id } },
      data: {
        ownerInternalNote: note || null,
        ownerNoteUpdatedAt: new Date(),
        ownerNoteUpdatedBy: user.id,
      },
    });
    if (!result.count) throw new NotFoundException('Không tìm thấy booking.');
    this.audit.recordSuccess(user, 'OWNER_BOOKING_NOTE_UPDATE', 'BOOKING', id);
    return this.detail(user, id);
  }

  private assertOwner(user: AuthenticatedUser) {
    if (user.role !== UserRole.HOTEL_OWNER || user.ownerAccessBlocked) {
      throw new ForbiddenException(
        'Bạn không có quyền quản lý booking khách sạn.',
      );
    }
  }

  private parseDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('Ngày lọc không hợp lệ.');
    }
    return date;
  }

  private parseCursor(
    value?: string,
  ): { createdAt: Date; id: string } | undefined {
    if (!value) return undefined;
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('invalid cursor');
      const parsed: unknown = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      );
      if (!parsed || typeof parsed !== 'object')
        throw new Error('invalid cursor');
      const cursor = parsed as Record<string, unknown>;
      if (
        typeof cursor.createdAt !== 'string' ||
        typeof cursor.id !== 'string' ||
        !cursor.id ||
        cursor.id.length > 120
      ) {
        throw new Error('invalid cursor');
      }
      const createdAt = new Date(cursor.createdAt);
      if (
        Number.isNaN(createdAt.getTime()) ||
        createdAt.toISOString() !== cursor.createdAt
      ) {
        throw new Error('invalid cursor');
      }
      return { createdAt, id: cursor.id };
    } catch {
      throw new BadRequestException('Con trỏ phân trang không hợp lệ.');
    }
  }

  private summary(booking: OwnerBookingRecord) {
    return {
      id: booking.id,
      code: booking.code,
      hotel: { id: booking.hotelId, name: booking.hotel.name },
      room: {
        id: booking.roomId,
        name: booking.roomNameSnapshot,
        type: booking.roomTypeSnapshot,
      },
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      adults: booking.adults,
      children: booking.children,
      roomCount: booking.roomCount,
      nights: booking.nights,
      totalAmount: booking.totalAmount.toString(),
      currency: booking.currency,
      status: booking.status,
      payment: this.paymentSummary(booking),
      createdAt: booking.createdAt,
      allowedActions: {
        canEditNote: true,
        canCheckIn: false,
        canCheckOut: false,
      },
    };
  }

  private paymentSummary(booking: OwnerBookingRecord) {
    if (booking.status === BookingStatus.REFUNDED) return { state: 'REFUNDED' };
    if (booking.status === BookingStatus.REFUND_PENDING)
      return { state: 'REFUND_PENDING' };
    if (
      booking.payments.some(
        (payment) =>
          payment.status === PaymentStatus.SUCCESS ||
          payment.status === PaymentStatus.PAID,
      )
    ) {
      return { state: 'PAID' };
    }
    if (booking.paymentMethod === BookingPaymentMethod.PAY_AT_HOTEL)
      return { state: 'PAY_AT_HOTEL' };
    return { state: booking.payments[0]?.status ?? 'PENDING' };
  }
}
