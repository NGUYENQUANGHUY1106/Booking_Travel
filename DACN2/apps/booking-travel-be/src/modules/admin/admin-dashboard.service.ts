import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma, RefundRequestStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const BOOKING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const to = new Date();
    const from = new Date(to.getTime() - BOOKING_WINDOW_MS);
    const vietnamMonth = new Date(to.getTime() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 7);
    const monthStart = new Date(`${vietnamMonth}-01T00:00:00+07:00`);
    const [bookingCount, audits, monthlyPayments, monthlyRefunds] =
      await Promise.all([
        this.prisma.booking.count({
          where: { createdAt: { gte: from, lt: to } },
        }),
        this.prisma.hotelSubmissionAudit.findMany({
          where: { action: { in: ['SUBMITTED', 'APPROVED', 'REJECTED'] } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 5,
          select: {
            id: true,
            action: true,
            createdAt: true,
            submission: {
              select: { snapshot: true, hotel: { select: { name: true } } },
            },
          },
        }),
        this.prisma.payment.groupBy({
          by: ['currency', 'method'],
          where: {
            status: {
              in: [
                PaymentStatus.PAID,
                PaymentStatus.SUCCESS,
                PaymentStatus.PARTIALLY_REFUNDED,
                PaymentStatus.REFUNDED,
              ],
            },
            OR: [
              { method: 'PAY_AT_HOTEL', paidAt: { gte: monthStart, lt: to } },
              { method: null, succeededAt: { gte: monthStart, lt: to } },
            ],
          },
          _sum: { amount: true },
        }),
        this.prisma.refundRequest.groupBy({
          by: ['currency'],
          where: {
            status: RefundRequestStatus.COMPLETED,
            completedAt: { gte: monthStart, lt: to },
          },
          _sum: { amount: true },
        }),
      ]);

    const currencies = new Set([
      ...monthlyPayments.map((item) => item.currency),
      ...monthlyRefunds.map((item) => item.currency),
    ]);
    const monthlyTransactions = [...currencies].sort().map((currency) => {
      const sum = (values: (Prisma.Decimal | null)[]) =>
        values.reduce<Prisma.Decimal>(
          (total, value) => total.add(value ?? 0),
          new Prisma.Decimal(0),
        );
      const property = sum(
        monthlyPayments
          .filter(
            (item) =>
              item.currency === currency && item.method === 'PAY_AT_HOTEL',
          )
          .map((item) => item._sum.amount),
      );
      const online = sum(
        monthlyPayments
          .filter(
            (item) =>
              item.currency === currency && item.method !== 'PAY_AT_HOTEL',
          )
          .map((item) => item._sum.amount),
      );
      const refunded = sum(
        monthlyRefunds
          .filter((item) => item.currency === currency)
          .map((item) => item._sum.amount),
      );
      return {
        currency,
        collectedAtProperty: property.toString(),
        collectedOnline: online.toString(),
        refunded: refunded.toString(),
        netTransactionValue: online.add(property).sub(refunded).toString(),
      };
    });

    return {
      generatedAt: to,
      bookings: { count: bookingCount, from, to, period: 'ROLLING_7_DAYS' },
      monthlyTransactions: {
        from: monthStart,
        to,
        values: monthlyTransactions,
      },
      activities: audits.map((audit) => ({
        id: audit.id,
        action: audit.action,
        hotelName:
          typeof audit.submission.snapshot === 'object' &&
          audit.submission.snapshot !== null &&
          !Array.isArray(audit.submission.snapshot) &&
          typeof audit.submission.snapshot.name === 'string'
            ? audit.submission.snapshot.name
            : audit.submission.hotel.name,
        occurredAt: audit.createdAt,
      })),
    };
  }
}
