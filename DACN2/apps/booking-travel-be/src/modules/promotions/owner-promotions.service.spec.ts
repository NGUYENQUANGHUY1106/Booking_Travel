import {
  OwnerPromotionStatus,
  PlatformDiscountType,
  Prisma,
  UserRole,
  VoucherRedemptionStatus,
} from '@prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { OwnerPromotionsService } from './owner-promotions.service';

describe('OwnerPromotionsService', () => {
  const promotion = {
    id: 'promo-a',
    code: 'PROMO-A',
    hotelId: 'hotel-a',
    title: 'Ưu đãi cuối tuần',
    description: null,
    status: OwnerPromotionStatus.ACTIVE as OwnerPromotionStatus,
    discountType: PlatformDiscountType.PERCENT,
    discountValue: new Prisma.Decimal('12'),
    maxDiscount: new Prisma.Decimal('250000'),
    currency: 'VND',
    startsAt: new Date('2029-12-01T00:00:00Z'),
    endsAt: new Date('2030-02-01T00:00:00Z'),
    stayStart: new Date('2030-01-02T00:00:00Z'),
    stayEnd: new Date('2030-01-04T00:00:00Z'),
    roomIds: ['room-a'],
    minNights: 2,
    quota: 1,
    reservedCount: 0,
    consumedCount: 0,
    version: 1,
  };
  const context = {
    hotelId: 'hotel-a',
    roomId: 'room-a',
    currency: 'VND',
    roomCount: 2,
    rates: [
      { date: '2030-01-01', price: new Prisma.Decimal('1000000') },
      { date: '2030-01-02', price: new Prisma.Decimal('1200000') },
      { date: '2030-01-03', price: new Prisma.Decimal('1300000') },
    ],
    now: new Date('2030-01-01T00:00:00Z'),
  };
  function subject(overrides: Partial<typeof promotion> = {}) {
    const candidate = { ...promotion, ...overrides };
    const db = {
      ownerPromotion: { findMany: jest.fn().mockResolvedValue([candidate]) },
    };
    return {
      candidate,
      db,
      service: new OwnerPromotionsService(db as unknown as PrismaService),
    };
  }

  it('discounts only eligible nights using seasonal nightly rates and caps VND', async () => {
    const { db, service } = subject();
    const priced = await service.preview(
      db as unknown as PrismaService,
      context,
    );
    expect(priced?.eligibleDates).toEqual(['2030-01-02', '2030-01-03']);
    expect(priced?.eligibleSubtotal.toString()).toBe('5000000');
    expect(priced?.discount.toString()).toBe('250000');
    expect(db.ownerPromotion.findMany).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ roomIds: ['room-b'] }, context],
    [{ status: OwnerPromotionStatus.PAUSED }, context],
    [{ reservedCount: 1 }, context],
    [{ minNights: 4 }, context],
    [{ stayStart: new Date('2030-01-04T00:00:00Z') }, context],
    [{ endsAt: new Date('2029-12-31T00:00:00Z') }, context],
  ])(
    'does not apply a promotion outside scope or quota',
    async (change, priceContext) => {
      const { db, service } = subject(change);
      expect(
        await service.preview(db as unknown as PrismaService, priceContext),
      ).toBeNull();
    },
  );

  it('selects one highest discount and rounds percentage to integer VND', async () => {
    const other = {
      ...promotion,
      id: 'promo-b',
      maxDiscount: new Prisma.Decimal('1000000'),
      discountValue: new Prisma.Decimal('12.5'),
    };
    const db = {
      ownerPromotion: {
        findMany: jest.fn().mockResolvedValue([promotion, other]),
      },
    };
    const service = new OwnerPromotionsService(db as unknown as PrismaService);
    const priced = await service.preview(
      db as unknown as PrismaService,
      context,
    );
    expect(priced?.promotion.id).toBe('promo-b');
    expect(priced?.discount.toString()).toBe('625000');
  });

  it('reserves once under a row lock and rejects a second booking after quota is used', async () => {
    const live = { ...promotion };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: live.id }]),
      ownerPromotion: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(live)),
        update: jest.fn().mockImplementation(() => {
          live.reservedCount++;
          return Promise.resolve(live);
        }),
      },
      ownerPromotionUsage: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new OwnerPromotionsService(tx as unknown as PrismaService);
    const input = {
      ...context,
      promotionId: live.id,
      version: live.version,
      expectedDiscount: '250000',
      bookingId: 'booking-a',
      reservedUntil: new Date('2030-01-01T00:15:00Z'),
    };
    await service.reserve(tx as unknown as Prisma.TransactionClient, input);
    const createCalls = tx.ownerPromotionUsage.create.mock.calls as unknown as [
      { data: { status: VoucherRedemptionStatus; amount: Prisma.Decimal } },
    ][];
    expect(createCalls[0][0].data.status).toBe(
      VoucherRedemptionStatus.RESERVED,
    );
    expect(createCalls[0][0].data.amount.toString()).toBe('250000');
    expect(live.reservedCount).toBe(1);
    await expect(
      service.reserve(tx as unknown as Prisma.TransactionClient, {
        ...input,
        bookingId: 'booking-b',
      }),
    ).rejects.toThrow('Ưu đãi đã thay đổi hoặc hết lượt. Hãy lấy báo giá mới.');
  });

  it('requires a verified owner and hides another owner hotel', async () => {
    const db = { hotel: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new OwnerPromotionsService(db as unknown as PrismaService);
    const actor = {
      id: 'owner-b',
      role: UserRole.HOTEL_OWNER,
      permissions: [],
    };
    await expect(service.list('hotel-a', {}, actor)).rejects.toMatchObject({
      status: 404,
    });
    expect(db.hotel.findFirst).toHaveBeenCalledWith({
      where: { id: 'hotel-a', ownerId: 'owner-b', deletedAt: null },
      select: {
        id: true,
        owner: {
          select: {
            isActive: true,
            ownerApplication: { select: { status: true } },
          },
        },
      },
    });
    db.hotel.findFirst.mockResolvedValue({
      id: 'hotel-a',
      owner: { isActive: true, ownerApplication: { status: 'PENDING' } },
    });
    await expect(service.list('hotel-a', {}, actor)).rejects.toMatchObject({
      status: 403,
    });
  });

  it.each(['CONSUMED', 'RELEASED'] as const)(
    'settles a reserved promotion once as %s',
    async (target) => {
      const usage: {
        id: string;
        promotionId: string;
        status: VoucherRedemptionStatus;
      } = {
        id: 'usage-a',
        promotionId: promotion.id,
        status: VoucherRedemptionStatus.RESERVED,
      };
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([{ id: promotion.id }]),
        ownerPromotionUsage: {
          findUnique: jest
            .fn()
            .mockImplementation(() => Promise.resolve(usage)),
          updateMany: jest.fn().mockImplementation(() => {
            usage.status =
              target === 'CONSUMED'
                ? VoucherRedemptionStatus.CONSUMED
                : VoucherRedemptionStatus.RELEASED;
            return Promise.resolve({ count: 1 });
          }),
        },
        ownerPromotion: { update: jest.fn().mockResolvedValue({}) },
      };
      const service = new OwnerPromotionsService(
        tx as unknown as PrismaService,
      );
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
      expect(tx.ownerPromotionUsage.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.ownerPromotion.update).toHaveBeenCalledWith({
        where: { id: promotion.id },
        data: {
          reservedCount: { decrement: 1 },
          ...(target === 'CONSUMED' ? { consumedCount: { increment: 1 } } : {}),
        },
      });
    },
  );
});
