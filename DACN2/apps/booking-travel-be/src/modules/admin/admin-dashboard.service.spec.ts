import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not exclude a just-created booking using a cross-clock upper bound', async () => {
    const now = new Date('2026-11-26T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    const count = jest.fn().mockResolvedValue(1);
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      booking: { count },
      hotelSubmissionAudit: { findMany },
      payment: { groupBy: jest.fn().mockResolvedValue([]) },
      refundRequest: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const service = new AdminDashboardService(
      prisma as unknown as PrismaService,
    );

    const result = await service.summary();

    expect(result.bookings.count).toBe(1);
    expect(count).toHaveBeenCalledWith({
      where: {
        createdAt: {
          gte: new Date('2026-11-19T10:00:00.000Z'),
        },
      },
    });
  });
});
