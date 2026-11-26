import { PaymentMethod, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminPaymentsService } from './admin-payments.service';

describe('AdminPaymentsService summary', () => {
  it('separates booked value, property collection and online collection without counting pending money', async () => {
    const prisma = {
      booking: {
        groupBy: jest.fn().mockResolvedValue([
          {
            currency: 'VND',
            _sum: { totalAmount: new Prisma.Decimal('3900000') },
          },
        ]),
      },
      payment: {
        groupBy: jest.fn().mockResolvedValue([
          {
            currency: 'VND',
            method: PaymentMethod.PAY_AT_HOTEL,
            _sum: { amount: new Prisma.Decimal('2900000') },
          },
          {
            currency: 'VND',
            method: null,
            _sum: { amount: new Prisma.Decimal('1000000') },
          },
        ]),
      },
      refundRequest: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { currency: 'VND', _sum: { amount: new Prisma.Decimal('200000') } },
          ]),
      },
    };
    const service = new AdminPaymentsService(
      prisma as unknown as PrismaService,
    );
    const result = await service.summary({
      id: 'admin-a',
      role: UserRole.ADMIN,
      permissions: ['BOOKING_SUPPORT'],
    });
    expect(result).toEqual([
      {
        currency: 'VND',
        confirmedBookingValue: '3900000',
        collectedAtProperty: '2900000',
        collectedOnline: '1000000',
        refunded: '200000',
        netTransactionValue: '3700000',
      },
    ]);
    const query = prisma.payment.groupBy.mock.calls[0] as unknown as [
      { where: { status: { in: string[] } } },
    ];
    expect(query[0].where.status.in).toContain('PAID');
    expect(query[0].where.status.in).toContain('SUCCESS');
  });
});
