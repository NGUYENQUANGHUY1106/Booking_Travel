import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  RefundRequestStatus,
  UserRole,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { todayInVietnam } from '../rooms/inventory';
import { refundEstimate } from './refund-policy';
import { SimulatorSignature } from '../payments/simulator-signature';
import type { RefundSimulatorEvent } from './refund-simulator-signature';

const RESERVED_STATUSES: RefundRequestStatus[] = [
  RefundRequestStatus.PENDING_REVIEW,
  RefundRequestStatus.APPROVED,
  RefundRequestStatus.PROCESSING,
];
const CAPTURED_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.PARTIALLY_REFUNDED,
];
const REFUNDABLE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.PARTIALLY_REFUNDED,
];
const CANCELLABLE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.PENDING_PAYMENT,
];
const CANCELLED_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.REFUND_PENDING,
  BookingStatus.REFUNDED,
];

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly simulator: SimulatorSignature,
  ) {}

  private requireAdmin(user: AuthenticatedUser) {
    if (
      user.role !== UserRole.ADMIN ||
      !user.permissions.includes('BOOKING_SUPPORT')
    )
      throw new ForbiddenException('Thiếu quyền xử lý hoàn tiền.');
  }

  private async ownedBooking(id: string, user: AuthenticatedUser) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, userId: user.id },
      include: { payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy đặt phòng.');
    return booking;
  }

  async preview(bookingId: string, user: AuthenticatedUser) {
    const booking = await this.ownedBooking(bookingId, user);
    const requests = await this.prisma.refundRequest.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
    const paid = booking.payments.filter(
      (payment) =>
        CAPTURED_PAYMENT_STATUSES.includes(payment.status) &&
        !payment.reconciliationRequired &&
        payment.provider === this.simulator.provider,
    );
    const cancellable =
      CANCELLABLE_BOOKING_STATUSES.includes(booking.status) &&
      booking.checkIn.toISOString().slice(0, 10) > todayInVietnam();
    const estimate =
      paid.length === 1
        ? refundEstimate({
            rules: booking.refundRulesSnapshot,
            checkIn: booking.checkIn,
            checkInTime: booking.checkInTimeSnapshot,
            cancelledAt: new Date(),
            paidAmount: paid[0].amount,
            currency: paid[0].currency,
          })
        : null;
    const usedAmount =
      paid.length === 1
        ? requests
            .filter(
              (request) =>
                request.paymentId === paid[0].id &&
                (
                  [
                    ...RESERVED_STATUSES,
                    RefundRequestStatus.COMPLETED,
                  ] as RefundRequestStatus[]
                ).includes(request.status),
            )
            .reduce(
              (sum, request) => sum.add(request.amount ?? 0),
              new Prisma.Decimal(0),
            )
        : new Prisma.Decimal(0);
    const remainingEstimate = estimate
      ? Prisma.Decimal.max(
          new Prisma.Decimal(0),
          estimate.refundAmount.sub(usedAmount),
        )
      : null;
    return {
      bookingId,
      bookingStatus: booking.status,
      canCancel: cancellable,
      reason: cancellable
        ? null
        : 'Đặt phòng đã đến ngày nhận phòng hoặc không còn ở trạng thái cho phép hủy.',
      policySnapshot: booking.cancellationPolicySnapshot,
      paymentMethod: booking.paymentMethod,
      currency: booking.currency,
      paidAmount: paid
        .reduce(
          (sum, payment) => sum.add(payment.amount),
          new Prisma.Decimal(0),
        )
        .toString(),
      refundEstimate: remainingEstimate?.toString() ?? null,
      cancellationFee: estimate?.cancellationFee.toString() ?? null,
      refundPercent: estimate?.refundPercent ?? null,
      requiresManualPolicyReview: paid.length > 0 && !estimate,
      requests: requests.map((request) => this.view(request)),
    };
  }

  async cancel(bookingId: string, user: AuthenticatedUser, reason: string) {
    if (!reason.trim()) throw new BadRequestException('Cần nhập lý do hủy.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findFirst({
        where: { id: bookingId, userId: user.id },
        include: { payments: { orderBy: { createdAt: 'desc' } } },
      });
      if (!booking) throw new NotFoundException('Không tìm thấy đặt phòng.');
      const existing = await tx.refundRequest.findMany({
        where: { bookingId, eventKey: { startsWith: 'CANCEL:' } },
      });
      if (CANCELLED_BOOKING_STATUSES.includes(booking.status)) {
        return {
          bookingId,
          bookingStatus: booking.status,
          requests: existing.map((request) => this.view(request)),
        };
      }
      if (
        !CANCELLABLE_BOOKING_STATUSES.includes(booking.status) ||
        booking.checkIn.toISOString().slice(0, 10) <= todayInVietnam()
      )
        throw new ConflictException('Đặt phòng không còn được phép hủy.');

      const paid = booking.payments.filter(
        (payment) =>
          CAPTURED_PAYMENT_STATUSES.includes(payment.status) &&
          !payment.reconciliationRequired &&
          payment.provider === this.simulator.provider,
      );
      if (booking.status === BookingStatus.PENDING_PAYMENT && paid.length)
        throw new ConflictException(
          'Thanh toán đến muộn cần được đối soát trước khi hủy.',
        );
      const [{ now }] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT statement_timestamp() AS now`;
      const requests = [];
      for (const payment of paid) {
        await tx.$queryRaw`SELECT "id" FROM "Payment" WHERE "id" = ${payment.id} FOR UPDATE`;
        const priorRefunds = await tx.refundRequest.findMany({
          where: {
            paymentId: payment.id,
            status: {
              in: [...RESERVED_STATUSES, RefundRequestStatus.COMPLETED],
            },
          },
          select: { amount: true },
        });
        const usedAmount = priorRefunds.reduce(
          (sum, item) => sum.add(item.amount ?? 0),
          new Prisma.Decimal(0),
        );
        const estimate =
          paid.length === 1
            ? refundEstimate({
                rules: booking.refundRulesSnapshot,
                checkIn: booking.checkIn,
                checkInTime: booking.checkInTimeSnapshot,
                cancelledAt: now,
                paidAmount: payment.amount,
                currency: payment.currency,
              })
            : null;
        const refundAmount = estimate
          ? Prisma.Decimal.max(
              new Prisma.Decimal(0),
              estimate.refundAmount.sub(usedAmount),
            )
          : null;
        if (refundAmount?.isZero()) continue;
        const eventKey = `CANCEL:${payment.id}`;
        const request = await tx.refundRequest.create({
          data: {
            bookingId,
            paymentId: payment.id,
            requesterId: user.id,
            eventKey,
            idempotencyKey: createHash('sha256')
              .update(`${bookingId}:${eventKey}`)
              .digest('hex'),
            provider: payment.provider!,
            amount: refundAmount,
            currency: payment.currency,
            reason: reason.trim(),
            calculationBasis: {
              policyText: booking.cancellationPolicySnapshot,
              rules: booking.refundRulesSnapshot,
              checkInTime: booking.checkInTimeSnapshot,
              paidAmount: payment.amount.toString(),
              previouslyRefundedOrReserved: usedAmount.toString(),
              refundPercent: estimate?.refundPercent ?? null,
              cancellationFee: estimate?.cancellationFee.toString() ?? null,
              evaluatedAt: now.toISOString(),
            },
          },
        });
        await tx.refundEvent.create({
          data: {
            refundRequestId: request.id,
            eventType: 'CREATED',
            actorId: user.id,
            detail: {
              status: request.status,
              amount: request.amount?.toString() ?? null,
            },
          },
        });
        requests.push(request);
      }
      const status = requests.length
        ? BookingStatus.REFUND_PENDING
        : BookingStatus.CANCELLED;
      await tx.booking.update({
        where: { id: bookingId },
        data: { status, cancelledAt: now },
      });
      await tx.payment.updateMany({
        where: { bookingId, status: PaymentStatus.PENDING },
        data: { status: PaymentStatus.CANCELLED, cancelledAt: now },
      });
      return {
        bookingId,
        bookingStatus: status,
        requests: requests.map((request) => this.view(request)),
      };
    });
  }

  async listForUser(user: AuthenticatedUser) {
    const requests = await this.prisma.refundRequest.findMany({
      where: { booking: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return requests.map((request) => this.view(request));
  }

  async getForUser(id: string, user: AuthenticatedUser) {
    const request = await this.prisma.refundRequest.findFirst({
      where: { id, booking: { userId: user.id } },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!request)
      throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền.');
    return { ...this.view(request), events: request.events };
  }

  async listForAdmin(
    user: AuthenticatedUser,
    status?: RefundRequestStatus,
    search?: string,
  ) {
    this.requireAdmin(user);
    const needle = search?.trim();
    if (needle && needle.length > 120)
      throw new BadRequestException('Từ khóa quá dài.');
    const requests = await this.prisma.refundRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(needle
          ? {
              OR: [
                { id: { contains: needle, mode: 'insensitive' as const } },
                {
                  provider: { contains: needle, mode: 'insensitive' as const },
                },
                {
                  booking: {
                    code: { contains: needle, mode: 'insensitive' as const },
                  },
                },
                {
                  booking: {
                    hotel: {
                      name: { contains: needle, mode: 'insensitive' as const },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        booking: { select: { code: true, hotel: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return requests.map((request) => ({
      ...this.view(request),
      bookingCode: request.booking.code,
      hotelName: request.booking.hotel.name,
    }));
  }

  async getForAdmin(id: string, user: AuthenticatedUser) {
    this.requireAdmin(user);
    const request = await this.prisma.refundRequest.findUnique({
      where: { id },
      include: {
        payment: {
          select: {
            amount: true,
            currency: true,
            status: true,
            providerTxnId: true,
            merchantReference: true,
          },
        },
        booking: {
          select: {
            code: true,
            cancellationPolicySnapshot: true,
            checkIn: true,
            hotel: { select: { name: true } },
          },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!request)
      throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền.');
    const siblings = await this.prisma.refundRequest.findMany({
      where: { paymentId: request.paymentId },
      select: { id: true, amount: true, status: true },
    });
    const completedAmount = siblings
      .filter((item) => item.status === RefundRequestStatus.COMPLETED)
      .reduce((sum, item) => sum.add(item.amount ?? 0), new Prisma.Decimal(0));
    const reservedAmount = siblings
      .filter((item) => RESERVED_STATUSES.includes(item.status))
      .reduce((sum, item) => sum.add(item.amount ?? 0), new Prisma.Decimal(0));
    return {
      ...this.view(request),
      payment: request.payment,
      booking: request.booking,
      events: request.events,
      completedAmount: completedAmount.toString(),
      reservedAmount: reservedAmount.toString(),
      remainingAmount: Prisma.Decimal.max(
        new Prisma.Decimal(0),
        request.payment.amount.sub(completedAmount).sub(reservedAmount),
      ).toString(),
    };
  }

  async decide(
    id: string,
    user: AuthenticatedUser,
    decision: 'APPROVE' | 'REJECT',
    reason: string,
  ) {
    this.requireAdmin(user);
    if (!reason.trim())
      throw new BadRequestException('Cần nhập lý do quyết định.');
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.refundRequest.findUnique({
        where: { id },
        select: { bookingId: true },
      });
      if (!target)
        throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền.');
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${target.bookingId} FOR UPDATE`;
      const request = await tx.refundRequest.findUnique({
        where: { id },
        include: { payment: true },
      });
      if (!request)
        throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền.');
      if (request.status !== RefundRequestStatus.PENDING_REVIEW)
        throw new ConflictException('Yêu cầu đã được xử lý.');
      if (decision === 'APPROVE' && (!request.amount || request.amount.lte(0)))
        throw new ConflictException(
          'Booking cũ chưa có quy tắc hoàn cấu trúc; cần đối soát chính sách trước khi duyệt tiền.',
        );
      const [{ now }] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT statement_timestamp() AS now`;
      if (decision === 'APPROVE') {
        await this.assertRefundBalance(
          tx,
          request.paymentId,
          request.amount!,
          request.id,
        );
      }
      const next = await tx.refundRequest.update({
        where: { id },
        data: {
          status:
            decision === 'APPROVE'
              ? RefundRequestStatus.APPROVED
              : RefundRequestStatus.REJECTED,
          reviewerId: user.id,
          reviewReason: reason.trim(),
          reviewedAt: now,
          providerRefundRef:
            decision === 'APPROVE' ? `BT-REF-${request.id}` : null,
        },
      });
      await tx.refundEvent.create({
        data: {
          refundRequestId: id,
          eventType: decision,
          actorId: user.id,
          detail: { reason: reason.trim(), status: next.status },
        },
      });
      if (decision === 'REJECT') {
        const remaining = await tx.refundRequest.count({
          where: {
            bookingId: target.bookingId,
            status: { in: RESERVED_STATUSES },
          },
        });
        if (!remaining)
          await tx.booking.updateMany({
            where: {
              id: target.bookingId,
              status: BookingStatus.REFUND_PENDING,
            },
            data: { status: BookingStatus.CANCELLED },
          });
      }
      return this.view(next);
    });
  }

  async dispatch(id: string, user: AuthenticatedUser) {
    this.requireAdmin(user);
    if (!this.simulator.enabled())
      throw new ServiceUnavailableException(
        'Cổng hoàn tiền mô phỏng chưa được cấu hình.',
      );
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.refundRequest.findUnique({
        where: { id },
        select: { bookingId: true },
      });
      if (!target)
        throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền.');
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${target.bookingId} FOR UPDATE`;
      const request = await tx.refundRequest.findUnique({
        where: { id },
        include: { payment: true },
      });
      if (!request)
        throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền.');
      if (request.status === RefundRequestStatus.PROCESSING)
        return this.view(request);
      if (request.status !== RefundRequestStatus.APPROVED || !request.amount)
        throw new ConflictException(
          'Yêu cầu chưa được duyệt để gửi cổng hoàn tiền.',
        );
      if (
        !request.payment.providerTxnId ||
        request.payment.provider !== this.simulator.provider
      )
        throw new ConflictException('Giao dịch gốc chưa có tham chiếu hợp lệ.');
      await this.assertRefundBalance(
        tx,
        request.paymentId,
        request.amount,
        request.id,
      );
      const next = await tx.refundRequest.update({
        where: { id },
        data: { status: RefundRequestStatus.PROCESSING },
      });
      await tx.refundEvent.create({
        data: {
          refundRequestId: id,
          eventType: 'SIMULATOR_AWAITING_CALLBACK',
          actorId: user.id,
        },
      });
      return this.view(next);
    });
  }

  async reopenFailed(id: string, user: AuthenticatedUser, reason: string) {
    this.requireAdmin(user);
    if (!reason.trim())
      throw new BadRequestException('Cần nhập lý do thử lại.');
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.refundRequest.findUnique({
        where: { id },
        select: { bookingId: true },
      });
      if (!target)
        throw new NotFoundException('Không tìm thấy yêu cầu hoàn tiền.');
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${target.bookingId} FOR UPDATE`;
      const request = await tx.refundRequest.findUnique({ where: { id } });
      if (!request || request.status !== RefundRequestStatus.FAILED)
        throw new ConflictException(
          'Chỉ có thể xem xét lại yêu cầu đã được cổng xác nhận thất bại.',
        );
      const retries = await tx.refundEvent.count({
        where: { refundRequestId: id, eventType: 'RETRY_REQUESTED' },
      });
      if (retries >= 3)
        throw new ConflictException(
          'Đã đạt giới hạn thử lại. Cần đối soát thủ công.',
        );
      if (!request.amount)
        throw new ConflictException('Yêu cầu chưa có số tiền được xác minh.');
      await this.assertRefundBalance(
        tx,
        request.paymentId,
        request.amount,
        request.id,
      );
      const updated = await tx.refundRequest.update({
        where: { id },
        data: { status: RefundRequestStatus.PENDING_REVIEW },
      });
      await tx.refundEvent.create({
        data: {
          refundRequestId: id,
          eventType: 'RETRY_REQUESTED',
          actorId: user.id,
          detail: {
            reason: reason.trim(),
            attempt: retries + 1,
            providerRefundRef: request.providerRefundRef,
          },
        },
      });
      await tx.booking.updateMany({
        where: { id: target.bookingId, status: BookingStatus.CANCELLED },
        data: { status: BookingStatus.REFUND_PENDING },
      });
      return this.view(updated);
    });
  }

  async simulatorWebhook(event: RefundSimulatorEvent, payloadHash: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const target = await tx.refundRequest.findUnique({
        where: {
          provider_providerRefundRef: {
            provider: 'SIMULATOR',
            providerRefundRef: event.providerRefundRef,
          },
        },
        select: { id: true, bookingId: true, paymentId: true },
      });
      if (target)
        await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${target.bookingId} FOR UPDATE`;
      const prior = await tx.refundWebhookReceipt.findUnique({
        where: {
          provider_eventId: { provider: 'SIMULATOR', eventId: event.eventId },
        },
      });
      if (prior)
        return {
          accepted:
            prior.payloadHash === payloadHash &&
            !['MISMATCH', 'UNKNOWN_REFERENCE', 'INVALID_STATE'].includes(
              prior.outcome,
            ),
          outcome:
            prior.payloadHash === payloadHash ? 'DUPLICATE' : 'EVENT_ID_REUSED',
        };
      const request = target
        ? await tx.refundRequest.findUnique({
            where: { id: target.id },
            include: { payment: true },
          })
        : null;
      const mismatch =
        !request ||
        !request.amount ||
        request.payment.merchantId !== event.merchantId ||
        request.payment.providerTxnId !== event.originalProviderTxnId ||
        request.amount.toString() !==
          new Prisma.Decimal(event.amount).toString() ||
        request.currency !== event.currency ||
        request.payment.currency !== event.currency;
      if (mismatch) {
        await tx.refundWebhookReceipt.create({
          data: {
            provider: 'SIMULATOR',
            eventId: event.eventId,
            payloadHash,
            outcome: request ? 'MISMATCH' : 'UNKNOWN_REFERENCE',
          },
        });
        return {
          accepted: false,
          outcome: request ? 'MISMATCH' : 'UNKNOWN_REFERENCE',
        };
      }
      if (request.status === RefundRequestStatus.COMPLETED) {
        await tx.refundWebhookReceipt.create({
          data: {
            provider: 'SIMULATOR',
            eventId: event.eventId,
            payloadHash,
            outcome: 'ALREADY_COMPLETED',
          },
        });
        return { accepted: true, outcome: 'ALREADY_COMPLETED' };
      }
      if (request.status !== RefundRequestStatus.PROCESSING) {
        await tx.refundWebhookReceipt.create({
          data: {
            provider: 'SIMULATOR',
            eventId: event.eventId,
            payloadHash,
            outcome: 'INVALID_STATE',
          },
        });
        return { accepted: false, outcome: 'INVALID_STATE' };
      }
      const [{ now }] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT statement_timestamp() AS now`;
      if (event.status === 'SUCCESS') {
        await tx.refundRequest.update({
          where: { id: request.id },
          data: {
            status: RefundRequestStatus.COMPLETED,
            completedAt: now,
          },
        });
        const completed = await tx.refundRequest.findMany({
          where: {
            paymentId: request.paymentId,
            status: RefundRequestStatus.COMPLETED,
          },
          select: { amount: true },
        });
        const total = completed.reduce(
          (sum, item) => sum.add(item.amount ?? 0),
          new Prisma.Decimal(0),
        );
        if (total.gt(request.payment.amount))
          throw new ConflictException('Số tiền hoàn vượt số đã thu.');
        await tx.payment.update({
          where: { id: request.paymentId },
          data: {
            status: total.equals(request.payment.amount)
              ? PaymentStatus.REFUNDED
              : PaymentStatus.PARTIALLY_REFUNDED,
          },
        });
        await tx.paymentOutboxEvent.upsert({
          where: {
            paymentId_eventType: {
              paymentId: request.paymentId,
              eventType: `REFUND_COMPLETED:${request.id}`,
            },
          },
          create: {
            paymentId: request.paymentId,
            eventType: `REFUND_COMPLETED:${request.id}`,
          },
          update: {},
        });
      } else {
        await tx.refundRequest.update({
          where: { id: request.id },
          data: {
            status: RefundRequestStatus.FAILED,
            failedAt: now,
            failureCode: event.failureCode ?? 'PROVIDER_FAILED',
          },
        });
      }
      await tx.refundEvent.create({
        data: {
          refundRequestId: request.id,
          eventType: `PROVIDER_${event.status}`,
          detail: {
            eventId: event.eventId,
            failureCode: event.failureCode ?? null,
          },
        },
      });
      const [remaining, completedForBooking, unrefundedPayments] =
        await Promise.all([
          tx.refundRequest.count({
            where: {
              bookingId: request.bookingId,
              status: { in: RESERVED_STATUSES },
            },
          }),
          tx.refundRequest.count({
            where: {
              bookingId: request.bookingId,
              status: RefundRequestStatus.COMPLETED,
            },
          }),
          tx.payment.count({
            where: {
              bookingId: request.bookingId,
              status: {
                in: [
                  PaymentStatus.SUCCESS,
                  PaymentStatus.PARTIALLY_REFUNDED,
                  PaymentStatus.PAID,
                ],
              },
            },
          }),
        ]);
      if (!remaining)
        await tx.booking.updateMany({
          where: {
            id: request.bookingId,
            status: BookingStatus.REFUND_PENDING,
          },
          data: {
            status:
              completedForBooking && !unrefundedPayments
                ? BookingStatus.REFUNDED
                : BookingStatus.CANCELLED,
          },
        });
      await tx.refundWebhookReceipt.create({
        data: {
          provider: 'SIMULATOR',
          eventId: event.eventId,
          payloadHash,
          outcome: event.status,
        },
      });
      return { accepted: true, outcome: event.status };
    });
    if (!result.accepted)
      throw new ConflictException({
        code: `REFUND_${result.outcome}`,
        message: 'Thông báo hoàn tiền không khớp giao dịch.',
      });
    return { acknowledged: true, outcome: result.outcome };
  }

  private async assertRefundBalance(
    tx: Prisma.TransactionClient,
    paymentId: string,
    amount: Prisma.Decimal,
    currentId: string,
  ) {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment || !REFUNDABLE_PAYMENT_STATUSES.includes(payment.status))
      throw new ConflictException('Giao dịch chưa thu tiền hoặc đã hoàn đủ.');
    const reserved = await tx.refundRequest.findMany({
      where: {
        paymentId,
        id: { not: currentId },
        status: { in: [...RESERVED_STATUSES, RefundRequestStatus.COMPLETED] },
      },
      select: { amount: true },
    });
    const used = reserved.reduce(
      (sum, item) => sum.add(item.amount ?? 0),
      new Prisma.Decimal(0),
    );
    if (used.add(amount).gt(payment.amount) || payment.currency !== 'VND')
      throw new ConflictException(
        'Số tiền hoàn vượt số đã thu hoặc tiền tệ không hỗ trợ.',
      );
  }

  private view(request: {
    id: string;
    bookingId: string;
    paymentId: string;
    provider: string;
    providerRefundRef: string | null;
    amount: Prisma.Decimal | null;
    currency: string;
    reason: string;
    status: RefundRequestStatus;
    reviewReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    completedAt: Date | null;
  }) {
    return {
      id: request.id,
      bookingId: request.bookingId,
      paymentId: request.paymentId,
      provider: request.provider,
      providerRefundRef: request.providerRefundRef,
      amount: request.amount?.toString() ?? null,
      currency: request.currency,
      reason: request.reason,
      status: request.status,
      reviewReason: request.reviewReason,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      completedAt: request.completedAt,
    };
  }
}
