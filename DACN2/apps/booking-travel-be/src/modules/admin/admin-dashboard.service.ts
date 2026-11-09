import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const BOOKING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const to = new Date();
    const from = new Date(to.getTime() - BOOKING_WINDOW_MS);
    const [bookingCount, audits] = await this.prisma.$transaction([
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
    ]);

    return {
      generatedAt: to,
      bookings: { count: bookingCount, from, to, period: 'ROLLING_7_DAYS' },
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
