import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';

const PAY_AT_HOTEL_INSTRUCTIONS =
  'Thanh toán trực tiếp tại quầy khách sạn khi nhận phòng.';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async initialize(
    userId: string,
    idempotencyKey: string,
    input: InitializePaymentDto,
  ) {
    return this.prisma.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.bookingId}))`;

        const repeated = await transaction.payment.findUnique({
          where: { idempotencyKey },
          include: { booking: { select: { code: true } } },
        });
        if (repeated) {
          if (
            repeated.userId !== userId ||
            repeated.bookingId !== input.bookingId ||
            repeated.method !== input.method
          ) {
            throw new ConflictException(
              'Idempotency-Key đã được dùng cho yêu cầu khác.',
            );
          }
          return this.response(repeated);
        }

        const booking = await transaction.booking.findFirst({
          where: { id: input.bookingId, userId },
          select: {
            id: true,
            code: true,
            userId: true,
            totalAmount: true,
            currency: true,
            status: true,
          },
        });
        if (!booking) {
          throw new NotFoundException('Không tìm thấy booking của bạn.');
        }
        if (booking.status !== BookingStatus.CONFIRMED) {
          throw new ConflictException(
            'Booking không ở trạng thái cho phép khởi tạo thanh toán.',
          );
        }
        if (input.method !== PaymentMethod.PAY_AT_HOTEL) {
          throw new BadRequestException(
            'Hiện chỉ hỗ trợ thanh toán tại khách sạn.',
          );
        }
        if (booking.totalAmount.lessThanOrEqualTo(0)) {
          throw new ConflictException('Tổng tiền booking không hợp lệ.');
        }

        const existing = await transaction.payment.findUnique({
          where: {
            bookingId_method: {
              bookingId: booking.id,
              method: input.method,
            },
          },
          include: { booking: { select: { code: true } } },
        });
        if (existing) return this.response(existing);

        const payment = await transaction.payment.create({
          data: {
            reference: `PAY-${randomUUID().slice(0, 8).toUpperCase()}`,
            bookingId: booking.id,
            userId: booking.userId,
            amount: booking.totalAmount,
            currency: booking.currency,
            method: input.method,
            status: PaymentStatus.PENDING,
            idempotencyKey,
          },
          include: { booking: { select: { code: true } } },
        });
        return this.response(payment);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async get(id: string, userId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, userId },
      include: { booking: { select: { code: true } } },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy thanh toán.');
    return this.response(payment);
  }

  async getByBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: { id: true },
    });
    if (!booking)
      throw new NotFoundException('Không tìm thấy booking của bạn.');
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId, userId },
      include: { booking: { select: { code: true } } },
    });
    if (!payment) throw new NotFoundException('Booking chưa có thanh toán.');
    return this.response(payment);
  }

  private response(payment: {
    id: string;
    reference: string;
    bookingId: string;
    amount: Prisma.Decimal;
    currency: string;
    method: PaymentMethod;
    status: PaymentStatus;
    createdAt: Date;
    booking: { code: string };
  }) {
    return {
      id: payment.id,
      reference: payment.reference,
      bookingId: payment.bookingId,
      bookingCode: payment.booking.code,
      amount: payment.amount,
      currency: payment.currency,
      method: payment.method,
      status: payment.status,
      instructions: PAY_AT_HOTEL_INSTRUCTIONS,
      createdAt: payment.createdAt,
    };
  }
}
