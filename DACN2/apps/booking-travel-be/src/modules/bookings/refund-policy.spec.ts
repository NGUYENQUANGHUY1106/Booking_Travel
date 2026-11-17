import { Prisma } from '@prisma/client';
import { parseRefundRules, refundEstimate } from './refund-policy';

describe('refund policy snapshot', () => {
  const rules = [
    { minimumHoursBeforeCheckIn: 0, refundPercent: 0 },
    { minimumHoursBeforeCheckIn: 24, refundPercent: 50 },
    { minimumHoursBeforeCheckIn: 48, refundPercent: 100 },
  ];
  const estimate = (cancelledAt: string, source: unknown = rules) =>
    refundEstimate({
      rules: source,
      checkIn: new Date('2030-01-10T00:00:00.000Z'),
      checkInTime: '14:00',
      cancelledAt: new Date(cancelledAt),
      paidAmount: new Prisma.Decimal('1000001'),
      currency: 'VND',
    });

  it('rejects free text and malformed rules instead of inventing a refund', () => {
    expect(estimate('2030-01-08T06:00:00.000Z', null)).toBeNull();
    expect(
      parseRefundRules([{ minimumHoursBeforeCheckIn: 24, refundPercent: 100 }]),
    ).toBeNull();
    expect(
      parseRefundRules([
        { minimumHoursBeforeCheckIn: 0, refundPercent: 80 },
        { minimumHoursBeforeCheckIn: 24, refundPercent: 50 },
      ]),
    ).toBeNull();
    expect(
      parseRefundRules([
        { minimumHoursBeforeCheckIn: 0, refundPercent: 0 },
        { minimumHoursBeforeCheckIn: 0, refundPercent: 100 },
      ]),
    ).toBeNull();
  });

  it('uses Vietnam check-in time and exact threshold', () => {
    expect(estimate('2030-01-08T07:00:00.000Z')?.refundPercent).toBe(100);
    expect(estimate('2030-01-08T07:00:01.000Z')?.refundPercent).toBe(50);
    expect(estimate('2030-01-09T07:00:00.000Z')?.refundAmount.toString()).toBe(
      '500000',
    );
    expect(estimate('2030-01-09T07:00:01.000Z')?.refundAmount.toString()).toBe(
      '0',
    );
  });
});
