import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  buildOwnerAnalytics,
  OwnerAnalyticsService,
} from './owner-analytics.service';
import { OwnerAnalyticsQueryDto } from './dto/owner-analytics-query.dto';

describe('ST-OWN-14 analytics contract', () => {
  it('reconciles confirmed receipts and later completed refunds without counting pending bookings', () => {
    const result = buildOwnerAnalytics(
      ['2026-11-01', '2026-11-02', '2026-11-03'],
      'DAY',
      [
        { id: 'a', name: 'Standard' },
        { id: 'b', name: 'Suite' },
      ],
      [
        { date: '2026-11-01', roomId: 'a', kind: 'PAYMENT', amount: '2000000' },
        { date: '2026-11-03', roomId: 'a', kind: 'REFUND', amount: '400000' },
      ],
      [
        { date: '2026-11-01', roomId: 'a', sold: 1, value: '1000000' },
        { date: '2026-11-02', roomId: 'a', sold: 1, value: '1000000' },
      ],
      [
        { date: '2026-11-01', roomId: 'a', capacity: 2 },
        { date: '2026-11-02', roomId: 'a', capacity: 1 },
        { date: '2026-11-03', roomId: 'a', capacity: 1 },
        { date: '2026-11-01', roomId: 'b', capacity: 1 },
        { date: '2026-11-02', roomId: 'b', capacity: 1 },
        { date: '2026-11-03', roomId: 'b', capacity: 1 },
      ],
      [
        {
          date: '2026-11-01',
          roomId: 'a',
          total: 2,
          cancelled: 0,
          gross: '2000000',
        },
        { date: '2026-11-03', roomId: 'a', total: 1, cancelled: 1, gross: '0' },
      ],
    );
    expect(result.summary).toMatchObject({
      bookedValue: 2000000,
      collected: 2000000,
      refunded: 400000,
      netCollected: 1600000,
      soldRoomNights: 2,
      sellableRoomNights: 7,
      adr: 1000000,
      bookingCount: 3,
      cancelledCount: 1,
    });
    expect(result.summary.occupancyPercent).toBeCloseTo(28.5714, 3);
    expect(result.summary.cancellationPercent).toBeCloseTo(33.3333, 3);
    expect(result.points.map((point) => point.netCollected)).toEqual([
      2000000, 0, -400000,
    ]);
    expect(result.rooms.find((room) => room.id === 'b')?.adr).toBeNull();
  });

  it('keeps empty periods as zero buckets and unavailable ratios as null', () => {
    const result = buildOwnerAnalytics(
      ['2026-11-01', '2026-11-02'],
      'DAY',
      [],
      [],
      [],
      [],
      [],
    );
    expect(result.points).toHaveLength(2);
    expect(result.summary.netCollected).toBe(0);
    expect(result.summary.occupancyPercent).toBeNull();
    expect(result.summary.adr).toBeNull();
    expect(result.summary.cancellationPercent).toBeNull();
  });

  it('groups days across month and year without changing the total cashflow', () => {
    const dates = ['2026-12-31', '2027-01-01'];
    const cash = [
      {
        date: dates[0],
        roomId: 'a',
        kind: 'PAYMENT' as const,
        amount: '100000',
      },
      { date: dates[1], roomId: 'a', kind: 'REFUND' as const, amount: '20000' },
    ];
    const result = buildOwnerAnalytics(
      dates,
      'MONTH',
      [{ id: 'a', name: 'A' }],
      cash,
      [],
      [],
      [],
    );
    expect(
      result.points.map((point) => [
        point.label,
        point.bucketStart,
        point.bucketEndExclusive,
        point.netCollected,
      ]),
    ).toEqual([
      ['2026-12', '2026-12-01', '2027-01-01', 100000],
      ['2027-01', '2027-01-01', '2027-02-01', -20000],
    ]);
    expect(result.summary.netCollected).toBe(80000);
  });

  it('rejects another owner hotel before reading finance or inventory', async () => {
    const tx = {
      hotel: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn(),
    };
    const prisma = {
      $transaction: jest.fn((run: (database: typeof tx) => unknown) => run(tx)),
    };
    const service = new OwnerAnalyticsService(
      prisma as unknown as PrismaService,
    );
    const query = {
      hotelId: 'hotel-b',
      dateFrom: '2026-11-01',
      dateTo: '2026-11-03',
      timeZone: 'Asia/Ho_Chi_Minh',
      granularity: 'DAY',
    } as OwnerAnalyticsQueryDto;
    await expect(service.get('owner-a', query)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });
});
