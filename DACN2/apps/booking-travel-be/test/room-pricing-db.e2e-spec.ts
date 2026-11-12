import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../src/common/types/authenticated-user';
import type { AuthorizationService } from '../src/common/authorization/authorization.service';
import type { AuditService } from '../src/common/authorization/audit.service';

const describeWithDatabase =
  process.env.RUN_DB_PRICING_E2E === '1' ? describe : describe.skip;

describeWithDatabase(
  'ST-OWN-09 PostgreSQL pricing and booking snapshot',
  () => {
    const prisma = new PrismaService();
    const pricing = new PricingService(prisma);
    const bookings = new BookingsService(
      prisma,
      {} as AuthorizationService,
      {} as AuditService,
      pricing,
    );
    const ownerId = randomUUID();
    const otherOwnerId = randomUUID();
    const travelerId = randomUUID();
    const hotelId = randomUUID();
    const roomId = randomUUID();
    const owner: AuthenticatedUser = {
      id: ownerId,
      role: 'HOTEL_OWNER',
      permissions: [],
    };
    const otherOwner: AuthenticatedUser = {
      id: otherOwnerId,
      role: 'HOTEL_OWNER',
      permissions: [],
    };
    const date = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const start = date(30);
    const second = date(31);
    const checkout = date(32);

    beforeAll(async () => {
      await prisma.$connect();
      for (const [id, role] of [
        [ownerId, 'HOTEL_OWNER'],
        [otherOwnerId, 'HOTEL_OWNER'],
        [travelerId, 'USER'],
      ] as const)
        await prisma.user.create({
          data: {
            id,
            email: `${id}@example.invalid`,
            fullName: 'Pricing QA',
            passwordHash: 'unused',
            role,
            status: 'ACTIVE',
            isActive: true,
          },
        });
      await prisma.hotel.create({
        data: {
          id: hotelId,
          ownerId,
          name: 'Pricing QA hotel',
          slug: hotelId,
          status: 'APPROVED',
          isVisible: true,
        },
      });
      await prisma.room.create({
        data: {
          id: roomId,
          hotelId,
          name: 'QA suite',
          type: 'QA',
          bedInfo: 'Double',
          quantity: 2,
          basePrice: 1000000,
        },
      });
    });

    afterAll(async () => {
      await prisma.booking.deleteMany({ where: { roomId } });
      await prisma.roomPricingAudit.deleteMany({ where: { roomId } });
      await prisma.roomPricingRule.deleteMany({ where: { roomId } });
      await prisma.room.deleteMany({ where: { id: roomId } });
      await prisma.hotel.deleteMany({ where: { id: hotelId } });
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, otherOwnerId, travelerId] } },
      });
      await prisma.$disconnect();
    });

    it('enforces owner, version, overlap and immutable booking nightly rates', async () => {
      await expect(
        pricing.month(otherOwner, hotelId, roomId, start.slice(0, 7)),
      ).rejects.toThrow(ForbiddenException);
      const first = await pricing.createRule(owner, hotelId, roomId, {
        kind: 'DATE',
        startDate: start,
        endDateExclusive: second,
        price: '1800000',
        expectedVersion: 1,
      });
      await expect(
        pricing.createRule(owner, hotelId, roomId, {
          kind: 'DATE',
          startDate: start,
          endDateExclusive: second,
          price: '1900000',
          expectedVersion: first.version,
        }),
      ).rejects.toThrow(ConflictException);
      await expect(
        pricing.setBase(owner, hotelId, roomId, {
          price: '1200000',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(ConflictException);
      const quote = await bookings.quote({
        roomId,
        checkIn: start,
        checkOut: checkout,
        adults: 2,
        roomCount: 1,
      });
      expect(quote.nightlyRates.map((rate) => rate.price.toString())).toEqual([
        '1800000',
        '1000000',
      ]);
      expect(quote.totalAmount.toString()).toBe('2800000');
      const booking = await bookings.create(travelerId, {
        roomId,
        checkIn: start,
        checkOut: checkout,
        adults: 2,
        roomCount: 1,
        guestName: 'QA Guest',
        guestEmail: 'qa@example.invalid',
      });
      expect(booking.totalAmount.toString()).toBe('2800000');
      expect(booking.nightlyRatesSnapshot).toEqual([
        {
          date: start,
          price: '1800000',
          source: 'DATE',
          ruleId: first.rule.id,
        },
        { date: second, price: '1000000', source: 'BASE', ruleId: null },
      ]);
      await pricing.deleteRule(
        owner,
        hotelId,
        roomId,
        first.rule.id,
        first.version,
      );
      expect(
        (
          await bookings.quote({
            roomId,
            checkIn: start,
            checkOut: checkout,
            adults: 2,
          })
        ).totalAmount.toString(),
      ).toBe('2000000');
      const saved = await prisma.booking.findUniqueOrThrow({
        where: { id: booking.id },
      });
      expect(saved.totalAmount.toString()).toBe('2800000');
    });
  },
);
