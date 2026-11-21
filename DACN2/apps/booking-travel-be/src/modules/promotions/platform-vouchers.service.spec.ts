import {
  PlatformDiscountType,
  PlatformVoucherStatus,
  Prisma,
  VoucherRedemptionStatus,
} from '@prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PlatformVouchersService } from './platform-vouchers.service';

describe('PlatformVouchersService pricing and reservations', () => {
  function subject(overrides: Record<string, unknown> = {}) {
    const voucher = {
      id: 'voucher-a',
      code: 'TRAVEL12',
      title: 'Travel 12',
      status: PlatformVoucherStatus.ACTIVE,
      discountType: PlatformDiscountType.PERCENT,
      discountValue: new Prisma.Decimal(12),
      maxDiscount: new Prisma.Decimal(522000),
      minSpend: new Prisma.Decimal(1000000),
      minNights: 2,
      currency: 'VND',
      startsAt: new Date('2020-01-01'),
      endsAt: new Date('2040-01-01'),
      hotelIds: ['hotel-a'],
      eligibleUserIds: [],
      globalLimit: 1,
      perUserLimit: 1,
      budget: new Prisma.Decimal(522000),
      reservedCount: 0,
      consumedCount: 0,
      reservedAmount: new Prisma.Decimal(0),
      consumedAmount: new Prisma.Decimal(0),
      version: 1,
      ...overrides,
    };
    const db = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: voucher.id }]),
      platformVoucher: {
        findUnique: jest
          .fn()
          .mockImplementation(() => Promise.resolve(voucher)),
        update: jest.fn().mockImplementation(
          ({
            data,
          }: {
            data: {
              reservedCount?: { increment: number };
              reservedAmount?: { increment: Prisma.Decimal };
            };
          }) => {
            if (data.reservedCount?.increment) voucher.reservedCount++;
            if (data.reservedAmount?.increment)
              voucher.reservedAmount = voucher.reservedAmount.add(
                data.reservedAmount.increment,
              );
            return Promise.resolve(voucher);
          },
        ),
      },
      voucherRedemption: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'redemption-a' }),
      },
    };
    const service = new PlatformVouchersService(db as unknown as PrismaService);
    const context = {
      code: ' travel12 ',
      userId: 'user-a',
      hotelId: 'hotel-a',
      currency: 'VND',
      subtotal: new Prisma.Decimal(7200000),
      nights: 3,
    };
    return { db, voucher, service, context };
  }

  it('caps a percentage discount and does not reserve during quote preview', async () => {
    const { db, service, context } = subject();
    const result = await service.preview(
      db as unknown as PrismaService,
      context,
    );
    expect(result.discount.toString()).toBe('522000');
    expect(db.voucherRedemption.create).not.toHaveBeenCalled();
    expect(db.platformVoucher.update).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: PlatformVoucherStatus.PAUSED }, 'VOUCHER_INACTIVE'],
    [{ endsAt: new Date('2021-01-01') }, 'VOUCHER_EXPIRED'],
    [{ hotelIds: ['hotel-b'] }, 'VOUCHER_HOTEL_INELIGIBLE'],
    [{ minSpend: new Prisma.Decimal(8000000) }, 'VOUCHER_MINIMUM_NOT_MET'],
    [{ reservedCount: 1 }, 'VOUCHER_EXHAUSTED'],
    [{ budget: new Prisma.Decimal(500000) }, 'VOUCHER_EXHAUSTED'],
    [{ eligibleUserIds: ['user-b'] }, 'VOUCHER_USER_INELIGIBLE'],
  ])(
    'rejects ineligible campaigns with reason code',
    async (override, reason) => {
      const { db, service, context } = subject(override);
      await expect(
        service.preview(db as unknown as PrismaService, context),
      ).rejects.toMatchObject({ response: { code: reason } });
    },
  );

  it('reserves one slot and amount; another checkout is rejected at the limit', async () => {
    const { db, service, context, voucher } = subject();
    const tx = db as unknown as Prisma.TransactionClient;
    const first = await service.reserve(tx, {
      ...context,
      bookingId: 'booking-a',
      reservedUntil: new Date('2030-01-01'),
    });
    expect(first.discount.toString()).toBe('522000');
    const calls = db.voucherRedemption.create.mock.calls as unknown as [
      {
        data: {
          bookingId: string;
          amount: Prisma.Decimal;
          status: VoucherRedemptionStatus;
        };
      },
    ][];
    const created = calls[0][0];
    expect(created.data.bookingId).toBe('booking-a');
    expect(created.data.amount.toString()).toBe('522000');
    expect(created.data.status).toBe(VoucherRedemptionStatus.RESERVED);
    expect(voucher.reservedCount).toBe(1);
    expect(voucher.reservedAmount.toString()).toBe('522000');
    await expect(
      service.reserve(tx, {
        ...context,
        bookingId: 'booking-b',
        reservedUntil: new Date('2030-01-01'),
      }),
    ).rejects.toMatchObject({ response: { code: 'VOUCHER_EXHAUSTED' } });
    expect(db.voucherRedemption.create).toHaveBeenCalledTimes(1);
  });

  it.each(['CONSUMED', 'RELEASED'] as const)(
    'settles a reservation once as %s',
    async (target) => {
      const amount = new Prisma.Decimal(522000);
      const redemption: {
        id: string;
        voucherId: string;
        bookingId: string;
        amount: Prisma.Decimal;
        status: VoucherRedemptionStatus;
      } = {
        id: 'redemption-a',
        voucherId: 'voucher-a',
        bookingId: 'booking-a',
        amount,
        status: VoucherRedemptionStatus.RESERVED,
      };
      let reservedCount = 1;
      let consumedCount = 0;
      let reservedAmount = amount;
      let consumedAmount = new Prisma.Decimal(0);
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'voucher-a' }]),
        voucherRedemption: {
          findUnique: jest
            .fn()
            .mockImplementation(() => Promise.resolve(redemption)),
          updateMany: jest.fn().mockImplementation(() => {
            if (redemption.status !== VoucherRedemptionStatus.RESERVED)
              return Promise.resolve({ count: 0 });
            redemption.status = target;
            return Promise.resolve({ count: 1 });
          }),
        },
        platformVoucher: {
          update: jest.fn().mockImplementation(
            ({
              data,
            }: {
              data: {
                reservedCount: { decrement: number };
                reservedAmount: { decrement: Prisma.Decimal };
                consumedCount?: { increment: number };
                consumedAmount?: { increment: Prisma.Decimal };
              };
            }) => {
              reservedCount -= data.reservedCount.decrement;
              reservedAmount = reservedAmount.sub(
                data.reservedAmount.decrement,
              );
              consumedCount += data.consumedCount?.increment ?? 0;
              consumedAmount = consumedAmount.add(
                data.consumedAmount?.increment ?? 0,
              );
              return Promise.resolve({});
            },
          ),
        },
      };
      const service = new PlatformVouchersService({} as PrismaService);
      await service.settle(
        tx as unknown as Prisma.TransactionClient,
        'booking-a',
        target,
      );
      await service.settle(
        tx as unknown as Prisma.TransactionClient,
        'booking-a',
        target,
      );
      expect(reservedCount).toBe(0);
      expect(reservedAmount.toString()).toBe('0');
      expect(consumedCount).toBe(target === 'CONSUMED' ? 1 : 0);
      expect(consumedAmount.toString()).toBe(
        target === 'CONSUMED' ? '522000' : '0',
      );
      expect(tx.platformVoucher.update).toHaveBeenCalledTimes(1);
    },
  );
});
