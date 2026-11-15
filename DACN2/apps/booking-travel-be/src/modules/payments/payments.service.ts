import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BookingPaymentMethod,
  BookingStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SimulatorSignature, type SimulatorEvent } from './simulator-signature';

const PAYMENT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signature: SimulatorSignature,
  ) {}

  methods() {
    return { payAtHotel: true, simulator: this.signature.enabled() };
  }

  async init(bookingId: string, user: AuthenticatedUser) {
    if (!this.signature.enabled())
      throw new ServiceUnavailableException({
        code: 'PAYMENT_PROVIDER_UNAVAILABLE',
        message: 'Cổng thanh toán mô phỏng chưa được bật.',
      });
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, userId: user.id },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đặt phòng.');
      const now = new Date();
      if (booking.status !== BookingStatus.PENDING_PAYMENT)
        throw new ConflictException({
          code: 'BOOKING_NOT_PAYABLE',
          message: 'Đặt phòng không còn chờ thanh toán.',
        });
      if (booking.paymentMethod !== BookingPaymentMethod.SIMULATOR)
        throw new ConflictException({
          code: 'PAYMENT_METHOD_MISMATCH',
          message: 'Đặt phòng này thanh toán tại khách sạn.',
        });
      if (booking.paymentDeadline && booking.paymentDeadline <= now) {
        throw new ConflictException({
          code: 'PAYMENT_DEADLINE_EXPIRED',
          message: 'Thời hạn giữ phòng đã hết.',
        });
      }
      const previous = await tx.payment.findFirst({
        where: { bookingId, provider: this.signature.provider },
        orderBy: { createdAt: 'desc' },
      });
      if (previous?.status === PaymentStatus.PENDING)
        return this.toInitResult(previous, booking.paymentDeadline!);
      if (previous?.status === PaymentStatus.SUCCESS)
        throw new ConflictException({
          code: 'PAYMENT_ALREADY_SUCCESS',
          message: 'Đặt phòng đã được thanh toán.',
        });
      const deadline =
        booking.paymentDeadline ?? new Date(now.getTime() + PAYMENT_WINDOW_MS);
      if (!booking.paymentDeadline)
        await tx.booking.update({
          where: { id: bookingId },
          data: { paymentDeadline: deadline },
        });
      const payment = await tx.payment.create({
        data: {
          bookingId,
          provider: this.signature.provider,
          merchantId: this.signature.merchantId,
          merchantReference: `BT-PAY-${randomUUID()}`,
          amount: booking.totalAmount,
          currency: booking.currency,
        },
      });
      return this.toInitResult(payment, deadline);
    });
  }

  async latestForBooking(bookingId: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId: user.id },
      select: { id: true },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy đặt phòng.');
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) throw new NotFoundException('Chưa có giao dịch thanh toán.');
    return this.status(payment.id, user);
  }

  async status(paymentId: string, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, booking: { userId: user.id } },
        include: {
          booking: {
            select: {
              id: true,
              code: true,
              status: true,
              paymentDeadline: true,
              totalAmount: true,
              currency: true,
              hotelId: true,
              hotel: {
                select: { name: true, coverImageUrl: true, checkInTime: true },
              },
              roomNameSnapshot: true,
              nights: true,
              adults: true,
              children: true,
              checkIn: true,
              checkOut: true,
            },
          },
        },
      });
      if (!payment)
        throw new NotFoundException('Không tìm thấy giao dịch thanh toán.');
      const booking = payment.booking;
      if (
        booking.status === BookingStatus.PENDING_PAYMENT &&
        booking.paymentDeadline &&
        booking.paymentDeadline <= new Date()
      ) {
        const updated = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: BookingStatus.PENDING_PAYMENT,
            paymentDeadline: { lte: new Date() },
            payments: { none: { status: PaymentStatus.SUCCESS } },
          },
          data: { status: BookingStatus.EXPIRED },
        });
        if (updated.count) booking.status = BookingStatus.EXPIRED;
      }
      return {
        id: payment.id,
        bookingId: booking.id,
        bookingCode: booking.code,
        bookingStatus: booking.status,
        paymentStatus: payment.status,
        provider: payment.provider,
        merchantReference: payment.merchantReference,
        amount: payment.amount.toString(),
        currency: payment.currency,
        paymentDeadline: booking.paymentDeadline,
        canRetry:
          payment.status === PaymentStatus.FAILED &&
          booking.status === BookingStatus.PENDING_PAYMENT &&
          Boolean(
            booking.paymentDeadline && booking.paymentDeadline > new Date(),
          ),
        updatedAt: payment.updatedAt,
        reconciliationRequired: payment.reconciliationRequired,
        failureReason: payment.failureReason,
        hotelId: booking.hotelId,
        hotelName: booking.hotel.name,
        hotelCoverImageUrl: booking.hotel.coverImageUrl,
        hotelCheckInTime: booking.hotel.checkInTime,
        roomName: booking.roomNameSnapshot,
        nights: booking.nights,
        adults: booking.adults,
        children: booking.children,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
      };
    });
  }

  async webhook(event: SimulatorEvent, payloadHash: string) {
    const provider = this.signature.provider;
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`${provider}:${event.eventId}`}))`;
      const initial = await tx.payment.findUnique({
        where: { merchantReference: event.merchantReference },
        select: {
          id: true,
          bookingId: true,
          booking: { select: { hotelId: true, roomId: true } },
        },
      });
      if (initial) {
        // Booking creation uses hotel then room locks. Take them in the same order before confirming inventory.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${initial.booking.hotelId}))`;
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${initial.booking.roomId}))`;
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${initial.bookingId} FOR UPDATE`;
      }
      const prior = await tx.paymentWebhookReceipt.findUnique({
        where: { provider_eventId: { provider, eventId: event.eventId } },
      });
      if (prior) {
        const sameAccepted =
          prior.payloadHash === payloadHash &&
          !['MISMATCH', 'UNKNOWN_REFERENCE'].includes(prior.outcome);
        return {
          outcome:
            prior.payloadHash === payloadHash ? 'DUPLICATE' : 'EVENT_ID_REUSED',
          accepted: sameAccepted,
        };
      }
      const payment = initial
        ? await tx.payment.findUnique({
            where: { id: initial.id },
            include: { booking: true },
          })
        : null;
      if (!payment) {
        await tx.paymentWebhookReceipt.create({
          data: {
            provider,
            eventId: event.eventId,
            payloadHash,
            outcome: 'UNKNOWN_REFERENCE',
          },
        });
        return { outcome: 'UNKNOWN_REFERENCE', accepted: false };
      }
      const amount = new Prisma.Decimal(event.amount);
      const existingTransaction = await tx.payment.findFirst({
        where: { providerTxnId: event.providerTxnId },
        select: { id: true },
      });
      if (
        payment.provider !== provider ||
        payment.merchantId !== event.merchantId ||
        !payment.amount.equals(amount) ||
        payment.currency !== event.currency ||
        (payment.providerTxnId &&
          payment.providerTxnId !== event.providerTxnId) ||
        (existingTransaction && existingTransaction.id !== payment.id) ||
        !payment.booking.totalAmount.equals(amount) ||
        payment.booking.currency !== event.currency
      ) {
        await tx.paymentWebhookReceipt.create({
          data: {
            provider,
            eventId: event.eventId,
            paymentId: payment.id,
            payloadHash,
            outcome: 'MISMATCH',
          },
        });
        return { outcome: 'MISMATCH', accepted: false };
      }

      const now = new Date();
      const booking = payment.booking;
      let outcome: string;
      if (event.status === 'PENDING') {
        outcome = 'PENDING';
      } else if (event.status === 'SUCCESS') {
        if (payment.status === PaymentStatus.SUCCESS) {
          outcome = 'ALREADY_SUCCESS';
        } else {
          const canConfirm =
            booking.status === BookingStatus.PENDING_PAYMENT &&
            Boolean(booking.paymentDeadline && booking.paymentDeadline > now);
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.SUCCESS,
              providerTxnId: event.providerTxnId,
              succeededAt: now,
              reconciliationRequired: !canConfirm,
              failureReason: null,
            },
          });
          if (canConfirm) {
            await tx.booking.update({
              where: { id: booking.id },
              data: { status: BookingStatus.CONFIRMED },
            });
            await tx.paymentOutboxEvent.upsert({
              where: {
                paymentId_eventType: {
                  paymentId: payment.id,
                  eventType: 'BOOKING_CONFIRMED',
                },
              },
              create: { paymentId: payment.id, eventType: 'BOOKING_CONFIRMED' },
              update: {},
            });
            outcome = 'CONFIRMED';
          } else {
            if (
              booking.status === BookingStatus.PENDING_PAYMENT &&
              booking.paymentDeadline &&
              booking.paymentDeadline <= now
            )
              await tx.booking.update({
                where: { id: booking.id },
                data: { status: BookingStatus.EXPIRED },
              });
            await tx.paymentReconciliationCase.upsert({
              where: {
                paymentId_reason: {
                  paymentId: payment.id,
                  reason: 'SUCCESS_WITHOUT_ACTIVE_BOOKING',
                },
              },
              create: {
                paymentId: payment.id,
                reason: 'SUCCESS_WITHOUT_ACTIVE_BOOKING',
              },
              update: {},
            });
            outcome = 'RECONCILIATION_REQUIRED';
          }
        }
      } else if (payment.status === PaymentStatus.SUCCESS) {
        outcome = 'STALE_FAILURE';
      } else {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PaymentStatus.FAILED,
            providerTxnId: event.providerTxnId,
            failureReason: event.failureReason ?? 'PROVIDER_FAILED',
            failedAt: now,
          },
        });
        if (
          booking.status === BookingStatus.PENDING_PAYMENT &&
          booking.paymentDeadline &&
          booking.paymentDeadline <= now
        )
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.EXPIRED },
          });
        outcome = 'FAILED';
      }
      await tx.paymentWebhookReceipt.create({
        data: {
          provider,
          eventId: event.eventId,
          paymentId: payment.id,
          payloadHash,
          outcome,
        },
      });
      return { outcome, accepted: true };
    });
    if (!result.accepted) {
      this.logger.warn(`Webhook rejected: ${result.outcome}`);
      throw new ConflictException({
        code: `PAYMENT_${result.outcome}`,
        message: 'Thông báo thanh toán không khớp giao dịch.',
      });
    }
    return { acknowledged: true, outcome: result.outcome };
  }

  private toInitResult(
    payment: {
      id: string;
      bookingId: string;
      merchantReference: string;
      amount: Prisma.Decimal;
      currency: string;
      status: PaymentStatus;
    },
    deadline: Date,
  ) {
    return {
      paymentId: payment.id,
      bookingId: payment.bookingId,
      provider: this.signature.provider,
      merchantReference: payment.merchantReference,
      amount: payment.amount.toString(),
      currency: payment.currency,
      status: payment.status,
      paymentDeadline: deadline,
      paymentUrl: null,
    };
  }
}
