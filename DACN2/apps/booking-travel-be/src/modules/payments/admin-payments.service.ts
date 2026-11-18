import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PaymentStatus,
  Prisma,
  RefundRequestStatus,
  UserRole,
} from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminPaymentsQueryDto } from './admin-payments-query.dto';

const RESERVED_REFUNDS: RefundRequestStatus[] = [
  RefundRequestStatus.PENDING_REVIEW,
  RefundRequestStatus.APPROVED,
  RefundRequestStatus.PROCESSING,
];
const CAPTURED_STATUSES: PaymentStatus[] = [
  PaymentStatus.SUCCESS,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

function maskedEmail(value: string) {
  const [name, domain] = value.split('@');
  return domain ? `${name.slice(0, 2)}***@${domain}` : 'Khách hàng';
}

@Injectable()
export class AdminPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireAdmin(user: AuthenticatedUser) {
    if (
      user.role !== UserRole.ADMIN ||
      !user.permissions.includes('BOOKING_SUPPORT')
    )
      throw new ForbiddenException('Thiếu quyền giám sát thanh toán.');
  }

  async list(user: AuthenticatedUser, query: AdminPaymentsQueryDto) {
    this.requireAdmin(user);
    if (
      query.from &&
      query.to &&
      new Date(query.from).getTime() > new Date(query.to).getTime()
    )
      throw new BadRequestException('Khoảng ngày không hợp lệ.');
    const needle = query.search?.trim();
    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.provider?.trim()
        ? { provider: { equals: query.provider.trim(), mode: 'insensitive' } }
        : {}),
      ...(query.scope === 'reconciliation'
        ? {
            OR: [
              { reconciliationRequired: true },
              { reconciliationCases: { some: { status: 'OPEN' } } },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(needle
        ? {
            AND: [
              {
                OR: [
                  { id: { contains: needle, mode: 'insensitive' } },
                  { reference: { contains: needle, mode: 'insensitive' } },
                  {
                    merchantReference: {
                      contains: needle,
                      mode: 'insensitive',
                    },
                  },
                  { providerTxnId: { contains: needle, mode: 'insensitive' } },
                  {
                    booking: {
                      code: { contains: needle, mode: 'insensitive' },
                    },
                  },
                  {
                    booking: {
                      hotel: {
                        name: { contains: needle, mode: 'insensitive' },
                      },
                    },
                  },
                ],
              },
            ],
          }
        : {}),
    };
    const order = query.sort === 'oldest' ? 'asc' : 'desc';
    const [total, payments] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        select: {
          id: true,
          bookingId: true,
          reference: true,
          merchantReference: true,
          providerTxnId: true,
          provider: true,
          amount: true,
          currency: true,
          status: true,
          reconciliationRequired: true,
          createdAt: true,
          updatedAt: true,
          booking: {
            select: {
              code: true,
              status: true,
              guestEmail: true,
              hotel: { select: { name: true } },
            },
          },
        },
        orderBy: [{ createdAt: order }, { id: order }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return {
      items: payments.map((payment) => ({
        id: payment.id,
        bookingId: payment.bookingId,
        bookingCode: payment.booking.code,
        bookingStatus: payment.booking.status,
        hotelName: payment.booking.hotel.name,
        guest: maskedEmail(payment.booking.guestEmail),
        provider: payment.provider,
        reference: payment.reference,
        merchantReference: payment.merchantReference,
        providerTxnId: payment.providerTxnId,
        amount: payment.amount.toString(),
        currency: payment.currency,
        status: payment.status,
        reconciliationRequired: payment.reconciliationRequired,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async detail(user: AuthenticatedUser, id: string) {
    this.requireAdmin(user);
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: {
        id: true,
        bookingId: true,
        reference: true,
        merchantReference: true,
        providerTxnId: true,
        provider: true,
        amount: true,
        currency: true,
        status: true,
        reconciliationRequired: true,
        paidAt: true,
        succeededAt: true,
        failedAt: true,
        createdAt: true,
        updatedAt: true,
        booking: {
          select: {
            id: true,
            code: true,
            status: true,
            totalAmount: true,
            currency: true,
            guestEmail: true,
            hotel: { select: { name: true } },
          },
        },
        receipts: {
          select: { id: true, eventId: true, outcome: true, createdAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
        },
        reconciliationCases: {
          select: { id: true, reason: true, status: true, createdAt: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
        },
        refundRequests: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            providerRefundRef: true,
            reviewedAt: true,
            completedAt: true,
            createdAt: true,
            failureCode: true,
            events: {
              select: {
                id: true,
                eventType: true,
                actorId: true,
                createdAt: true,
                detail: true,
              },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        },
      },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy giao dịch.');
    const attempts = await this.prisma.payment.findMany({
      where: { bookingId: payment.bookingId },
      select: {
        id: true,
        provider: true,
        providerTxnId: true,
        merchantReference: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    const completed = payment.refundRequests
      .filter((refund) => refund.status === RefundRequestStatus.COMPLETED)
      .reduce(
        (sum, refund) => sum.add(refund.amount ?? 0),
        new Prisma.Decimal(0),
      );
    const reserved = payment.refundRequests
      .filter((refund) => RESERVED_REFUNDS.includes(refund.status))
      .reduce(
        (sum, refund) => sum.add(refund.amount ?? 0),
        new Prisma.Decimal(0),
      );
    const captured = CAPTURED_STATUSES.includes(payment.status)
      ? payment.amount
      : new Prisma.Decimal(0);
    const refundEventIds = payment.refundRequests
      .flatMap((refund) =>
        refund.events.map((event) => {
          const detail = event.detail;
          return detail &&
            typeof detail === 'object' &&
            !Array.isArray(detail) &&
            typeof detail.eventId === 'string'
            ? detail.eventId
            : null;
        }),
      )
      .filter((eventId): eventId is string => !!eventId);
    const refundReceipts = refundEventIds.length
      ? await this.prisma.refundWebhookReceipt.findMany({
          where: {
            provider: payment.provider ?? undefined,
            eventId: { in: refundEventIds },
          },
          select: {
            id: true,
            provider: true,
            eventId: true,
            outcome: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : [];
    return {
      id: payment.id,
      reference: payment.reference,
      merchantReference: payment.merchantReference,
      providerTxnId: payment.providerTxnId,
      provider: payment.provider,
      amount: payment.amount.toString(),
      currency: payment.currency,
      status: payment.status,
      reconciliationRequired: payment.reconciliationRequired,
      paidAt: payment.paidAt,
      succeededAt: payment.succeededAt,
      failedAt: payment.failedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
      booking: {
        ...payment.booking,
        guestEmail: maskedEmail(payment.booking.guestEmail),
        totalAmount: payment.booking.totalAmount.toString(),
      },
      attempts: attempts.map((attempt) => ({
        ...attempt,
        amount: attempt.amount.toString(),
      })),
      receipts: payment.receipts,
      reconciliationCases: payment.reconciliationCases,
      refunds: payment.refundRequests.map((refund) => ({
        id: refund.id,
        amount: refund.amount?.toString() ?? null,
        currency: refund.currency,
        status: refund.status,
        providerRefundRef: refund.providerRefundRef,
        reviewedAt: refund.reviewedAt,
        completedAt: refund.completedAt,
        createdAt: refund.createdAt,
        failureCode: refund.failureCode,
        events: refund.events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          actorId: event.actorId,
          createdAt: event.createdAt,
          reason:
            event.detail &&
            typeof event.detail === 'object' &&
            !Array.isArray(event.detail) &&
            typeof event.detail.reason === 'string'
              ? event.detail.reason
              : null,
        })),
      })),
      refundReceipts,
      completedAmount: completed.toString(),
      reservedAmount: reserved.toString(),
      remainingAmount: Prisma.Decimal.max(
        new Prisma.Decimal(0),
        captured.sub(completed).sub(reserved),
      ).toString(),
    };
  }
}
