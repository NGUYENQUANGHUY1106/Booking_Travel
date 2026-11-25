import { randomUUID } from 'node:crypto';
import {
  BookingPaymentMethod,
  PlatformDiscountType,
  Prisma,
  UserRole,
  VoucherRedemptionStatus,
} from '@prisma/client';
import type { AuditService } from '../src/common/authorization/audit.service';
import type { AuthorizationService } from '../src/common/authorization/authorization.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BookingQuoteToken } from '../src/modules/bookings/booking-quote-token';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { OwnerPromotionsService } from '../src/modules/promotions/owner-promotions.service';
import { PlatformVouchersService } from '../src/modules/promotions/platform-vouchers.service';

describe('ST-OWN-10 real quote and quota', () => {
  const prisma = new PrismaService();
  const ownerPromotions = new OwnerPromotionsService(prisma);
  const bookings = new BookingsService(
    prisma,
    {} as AuthorizationService,
    {} as AuditService,
    new PricingService(prisma),
    new BookingQuoteToken(),
    new PlatformVouchersService(prisma),
    ownerPromotions,
  );
  const promotionIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });
  afterAll(async () => {
    for (const promotionId of promotionIds) {
      const rows = await prisma.ownerPromotionUsage.findMany({
        where: { promotionId },
        select: { bookingId: true },
      });
      await prisma.ownerPromotionUsage.deleteMany({ where: { promotionId } });
      await prisma.booking.deleteMany({
        where: { id: { in: rows.map((row) => row.bookingId) } },
      });
      await prisma.ownerPromotionAudit.deleteMany({ where: { promotionId } });
      await prisma.ownerPromotion.delete({ where: { id: promotionId } });
    }
    await prisma.$disconnect();
  });

  it('applies only to the owned room and lets one of two concurrent bookings use the sole slot', async () => {
    const room = await prisma.room.findUnique({
      where: { id: 'seed-room-deluxe-sea-view' },
      include: {
        hotel: { include: { owner: { include: { ownerApplication: true } } } },
      },
    });
    const users = await prisma.user.findMany({
      where: {
        id: { in: ['seed-user-traveler', 'seed-user-traveler-b'] },
        isActive: true,
      },
      select: { id: true, email: true, fullName: true },
    });
    if (
      !room ||
      users.length !== 2 ||
      room.hotel.owner.ownerApplication?.status !== 'VERIFIED'
    )
      throw new Error(
        'Run prisma:seed before the owner promotion integration test.',
      );
    const owner = {
      id: room.hotel.ownerId,
      role: UserRole.HOTEL_OWNER,
      permissions: [],
      sessionId: 'owner-integration',
    };
    const inDate = new Date(Date.now() + 120 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const outDate = new Date(Date.now() + 122 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const created = await ownerPromotions.create(
      room.hotelId,
      {
        title: `Kiểm thử ST-OWN-10 ${randomUUID().slice(0, 8)}`,
        discountType: PlatformDiscountType.FIXED,
        discountValue: '100000',
        currency: 'VND',
        startsAt: new Date(Date.now() - 86_400_000).toISOString(),
        endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        stayStart: inDate,
        stayEnd: outDate,
        roomIds: [room.id],
        minNights: 2,
        quota: 1,
      },
      owner,
    );
    promotionIds.push(created.id);
    const active = await ownerPromotions.action(
      room.hotelId,
      created.id,
      'activate',
      { version: created.version },
      owner,
    );
    await expect(
      ownerPromotions.list(room.hotelId, {}, { ...owner, id: 'other-owner' }),
    ).rejects.toMatchObject({ status: 404 });
    const quotes = await Promise.all(
      users.map(async (user, index) => {
        const actor = {
          id: user.id,
          role: UserRole.USER,
          permissions: [],
          sessionId: `owner-promo-${index}`,
        };
        const quote = await bookings.quote(
          {
            roomId: room.id,
            checkIn: inDate,
            checkOut: outDate,
            adults: 1,
            roomCount: 1,
          },
          actor,
        );
        expect(quote.discounts).toEqual([
          {
            label: `${created.title} · Khách sạn tài trợ`,
            amount: '100000',
            source: 'OWNER',
            eligibleDates: [
              inDate,
              new Date(Date.parse(`${inDate}T00:00:00Z`) + 86_400_000)
                .toISOString()
                .slice(0, 10),
            ],
          },
        ]);
        return { actor, quote, user };
      }),
    );
    expect(
      (
        await prisma.ownerPromotion.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).reservedCount,
    ).toBe(0);
    const outcomes = await Promise.allSettled(
      quotes.map(({ actor, quote, user }) =>
        bookings.create(actor, {
          quoteId: quote.quoteId,
          roomId: room.id,
          checkIn: inDate,
          checkOut: outDate,
          adults: 1,
          roomCount: 1,
          guestName: user.fullName || 'Khách kiểm thử',
          guestEmail: user.email || `${user.id}@example.com`,
          paymentMethod: BookingPaymentMethod.PAY_AT_HOTEL,
        }),
      ),
    );
    const successes = outcomes.filter(
      (result) => result.status === 'fulfilled',
    );
    expect(successes).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const booking =
      successes[0].status === 'fulfilled' ? successes[0].value : null;
    expect(booking?.ownerPromotionSnapshot).toMatchObject({
      source: 'OWNER',
      promotionId: created.id,
      discountAmount: '100000',
      version: active.version,
    });
    expect(booking?.totalAmount.toString()).toBe(
      new Prisma.Decimal(quotes[0].quote.roomSubtotal).sub(100000).toString(),
    );
    const usages = await prisma.ownerPromotionUsage.findMany({
      where: { promotionId: created.id },
    });
    expect(usages).toHaveLength(1);
    expect(usages[0].status).toBe(VoucherRedemptionStatus.CONSUMED);
    const used = await prisma.ownerPromotion.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect([used.reservedCount, used.consumedCount]).toEqual([0, 1]);
    await ownerPromotions.action(
      room.hotelId,
      created.id,
      'pause',
      { version: used.version, reason: 'Tạm dừng sau kiểm thử' },
      owner,
    );
    expect(
      (
        await prisma.booking.findUniqueOrThrow({ where: { id: booking!.id } })
      ).totalAmount.toString(),
    ).toBe(booking!.totalAmount.toString());
    const audit = await prisma.ownerPromotionAudit.findMany({
      where: { promotionId: created.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((entry) => entry.action)).toEqual([
      'CREATE',
      'ACTIVATE',
      'PAUSE',
    ]);
  });
});
