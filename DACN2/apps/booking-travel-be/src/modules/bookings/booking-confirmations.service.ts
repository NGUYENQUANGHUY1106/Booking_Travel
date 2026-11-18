import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingQrToken } from './booking-qr-token';

const QR_ELIGIBLE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.CHECKED_IN,
];

@Injectable()
export class BookingConfirmationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qrTokens: BookingQrToken,
  ) {}

  async get(bookingId: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.id },
      select: {
        id: true,
        code: true,
        status: true,
        hotelId: true,
        hotelNameSnapshot: true,
        hotelAddressSnapshot: true,
        roomNameSnapshot: true,
        roomTypeSnapshot: true,
        checkIn: true,
        checkOut: true,
        adults: true,
        children: true,
        roomCount: true,
        totalAmount: true,
        currency: true,
        guestName: true,
        hotel: {
          select: {
            checkInTime: true,
            checkOutTime: true,
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy booking.');
    if (!QR_ELIGIBLE_STATUSES.includes(booking.status)) {
      throw new ConflictException({
        code: 'BOOKING_NOT_CONFIRMED',
        message: 'Booking chưa ở trạng thái cho phép tạo mã QR nhận phòng.',
      });
    }

    const checkIn = this.dateOnly(booking.checkIn);
    const checkOut = this.dateOnly(booking.checkOut);
    const qr = this.qrTokens.issue({
      bookingId: booking.id,
      bookingCode: booking.code,
      hotelId: booking.hotelId,
      checkIn,
      checkOut,
    });
    if (Date.now() > new Date(qr.expiresAt).getTime()) {
      throw new ConflictException({
        code: 'BOOKING_QR_EXPIRED',
        message: 'Mã QR nhận phòng đã hết hạn.',
      });
    }

    return {
      booking: {
        id: booking.id,
        code: booking.code,
        status: booking.status,
        checkIn,
        checkOut,
        adults: booking.adults,
        children: booking.children,
        roomCount: booking.roomCount,
        roomName: booking.roomNameSnapshot,
        roomType: booking.roomTypeSnapshot,
        totalAmount: booking.totalAmount.toString(),
        currency: booking.currency,
      },
      hotel: {
        id: booking.hotelId,
        name: booking.hotelNameSnapshot,
        address: booking.hotelAddressSnapshot,
        checkInTime: booking.hotel.checkInTime,
        checkOutTime: booking.hotel.checkOutTime,
      },
      guest: { name: booking.guestName },
      qr: {
        ...qr,
        format: 'BOOKING_TRAVEL_CHECK_IN_V1' as const,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
