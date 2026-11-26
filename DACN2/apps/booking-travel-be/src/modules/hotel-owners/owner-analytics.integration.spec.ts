import {
  BookingStatus,
  PrismaClient,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OwnerAnalyticsService } from './owner-analytics.service';

const TEST_URL = process.env.ST_OWN14_TEST_DATABASE_URL;
if (TEST_URL) {
  const parsed = new URL(TEST_URL);
  if (
    !['127.0.0.1', 'localhost'].includes(parsed.hostname) ||
    !parsed.pathname.endsWith('_test')
  ) {
    throw new Error(
      'ST_OWN14_TEST_DATABASE_URL must point to a local *_test database.',
    );
  }
}

(TEST_URL ? describe : describe.skip)('Owner analytics on PostgreSQL', () => {
  const db = TEST_URL
    ? new PrismaClient({ datasources: { db: { url: TEST_URL } } })
    : new PrismaClient();
  const service = new OwnerAnalyticsService(db as unknown as PrismaService);
  const prefix = `own14_${Date.now()}_`;
  const id = (name: string) => `${prefix}${name}`;
  const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
  const at = (value: string) => new Date(`${value}Z`);
  const query = {
    dateFrom: '2026-11-01',
    dateTo: '2026-11-03',
    timeZone: 'Asia/Ho_Chi_Minh',
    granularity: 'DAY' as const,
  };

  async function booking(
    name: string,
    hotel: string,
    room: string,
    status: BookingStatus,
    amount: number,
    checkIn: string,
    checkOut: string,
    createdAt: string,
    paymentMethod: 'SIMULATOR' | 'PAY_AT_HOTEL' = 'SIMULATOR',
  ) {
    const nights =
      (day(checkOut).getTime() - day(checkIn).getTime()) / 86_400_000;
    return db.booking.create({
      data: {
        id: id(name),
        code: id(name),
        userId: id('guest'),
        hotelId: id(hotel),
        roomId: id(room),
        hotelNameSnapshot: hotel,
        hotelAddressSnapshot: 'Test',
        roomNameSnapshot: room,
        roomTypeSnapshot: room,
        checkIn: day(checkIn),
        checkOut: day(checkOut),
        adults: 1,
        roomCount: 1,
        nights,
        pricePerNight: amount / nights,
        totalAmount: amount,
        status,
        paymentMethod,
        guestName: 'Fixture guest',
        guestEmail: 'fixture@example.invalid',
        createdAt: at(createdAt),
      },
    });
  }

  beforeAll(async () => {
    await db.user.createMany({
      data: [
        {
          id: id('owner-a'),
          fullName: 'Owner A',
          passwordHash: 'x',
          role: UserRole.HOTEL_OWNER,
          status: UserStatus.ACTIVE,
          isActive: true,
        },
        {
          id: id('owner-b'),
          fullName: 'Owner B',
          passwordHash: 'x',
          role: UserRole.HOTEL_OWNER,
          status: UserStatus.ACTIVE,
          isActive: true,
        },
        {
          id: id('guest'),
          fullName: 'Guest',
          passwordHash: 'x',
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          isActive: true,
        },
      ],
    });
    await db.hotel.createMany({
      data: [
        {
          id: id('hotel-a1'),
          ownerId: id('owner-a'),
          name: 'A1',
          slug: id('hotel-a1'),
          status: 'APPROVED',
        },
        {
          id: id('hotel-a2'),
          ownerId: id('owner-a'),
          name: 'A2',
          slug: id('hotel-a2'),
          status: 'APPROVED',
        },
        {
          id: id('hotel-b'),
          ownerId: id('owner-b'),
          name: 'B',
          slug: id('hotel-b'),
          status: 'APPROVED',
        },
      ],
    });
    await db.room.createMany({
      data: [
        {
          id: id('room-a1'),
          hotelId: id('hotel-a1'),
          name: 'Standard',
          type: 'STANDARD',
          bedInfo: 'Double',
          quantity: 2,
          basePrice: 1000000,
        },
        {
          id: id('room-a2'),
          hotelId: id('hotel-a2'),
          name: 'Suite',
          type: 'SUITE',
          bedInfo: 'Double',
          quantity: 1,
          basePrice: 1500000,
        },
        {
          id: id('room-b'),
          hotelId: id('hotel-b'),
          name: 'Secret',
          type: 'SUITE',
          bedInfo: 'Double',
          quantity: 1,
          basePrice: 5000000,
        },
      ],
    });
    await db.roomInventoryBlock.create({
      data: {
        id: id('block'),
        roomId: id('room-a1'),
        hotelId: id('hotel-a1'),
        actorId: id('owner-a'),
        startDate: day('2026-11-02'),
        endDateExclusive: day('2026-11-03'),
        quantity: 1,
        reason: 'Fixture',
        idempotencyKey: id('block'),
      },
    });
    await booking(
      'paid-a1',
      'hotel-a1',
      'room-a1',
      'CONFIRMED',
      2000000,
      '2026-11-01',
      '2026-11-03',
      '2026-10-31T18:00:00.000',
    );
    await booking(
      'paid-a2',
      'hotel-a2',
      'room-a2',
      'COMPLETED',
      1500000,
      '2026-11-02',
      '2026-11-03',
      '2026-11-01T18:00:00.000',
    );
    await booking(
      'pending',
      'hotel-a1',
      'room-a1',
      'PENDING_PAYMENT',
      500000,
      '2026-11-02',
      '2026-11-03',
      '2026-10-31T18:00:00.000',
    );
    await booking(
      'cancelled',
      'hotel-a1',
      'room-a1',
      'CANCELLED',
      1000000,
      '2026-11-03',
      '2026-11-04',
      '2026-11-01T18:00:00.000',
    );
    await booking(
      'pay-hotel',
      'hotel-a1',
      'room-a1',
      'CONFIRMED',
      700000,
      '2026-11-03',
      '2026-11-04',
      '2026-11-02T18:00:00.000',
      'PAY_AT_HOTEL',
    );
    await booking(
      'collected-hotel',
      'hotel-a1',
      'room-a1',
      'CHECKED_IN',
      900000,
      '2026-11-02',
      '2026-11-03',
      '2026-10-31T18:00:00.000',
      'PAY_AT_HOTEL',
    );
    await booking(
      'paid-b',
      'hotel-b',
      'room-b',
      'CONFIRMED',
      5000000,
      '2026-11-01',
      '2026-11-02',
      '2026-10-31T18:00:00.000',
    );
    await db.payment.createMany({
      data: [
        {
          id: id('payment-a1'),
          bookingId: id('paid-a1'),
          amount: 2000000,
          status: 'PARTIALLY_REFUNDED',
          succeededAt: at('2026-10-31T18:00:00.000'),
        },
        {
          id: id('payment-a2'),
          bookingId: id('paid-a2'),
          amount: 1500000,
          status: 'SUCCESS',
          succeededAt: at('2026-11-01T18:00:00.000'),
        },
        {
          id: id('payment-pending'),
          bookingId: id('pending'),
          amount: 500000,
          status: 'PENDING',
        },
        {
          id: id('payment-hotel'),
          bookingId: id('pay-hotel'),
          amount: 700000,
          status: 'PAID',
          method: 'PAY_AT_HOTEL',
        },
        {
          id: id('payment-collected-hotel'),
          bookingId: id('collected-hotel'),
          amount: 900000,
          status: 'PAID',
          method: 'PAY_AT_HOTEL',
          paidAt: at('2026-11-01T18:00:00.000'),
          collectedById: id('owner-a'),
          propertyCollectionMethod: 'CASH',
        },
        {
          id: id('payment-b'),
          bookingId: id('paid-b'),
          amount: 5000000,
          status: 'SUCCESS',
          succeededAt: at('2026-10-31T18:00:00.000'),
        },
      ],
    });
    await db.refundRequest.create({
      data: {
        id: id('refund'),
        bookingId: id('paid-a1'),
        paymentId: id('payment-a1'),
        requesterId: id('guest'),
        eventKey: id('refund'),
        idempotencyKey: id('refund'),
        provider: 'SIMULATOR',
        amount: 400000,
        currency: 'VND',
        reason: 'Fixture',
        calculationBasis: {},
        status: 'COMPLETED',
        completedAt: at('2026-11-02T18:00:00.000'),
      },
    });
  });

  afterAll(async () => {
    await db.refundRequest.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    await db.payment.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.booking.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.roomInventoryBlock.deleteMany({
      where: { id: { startsWith: prefix } },
    });
    await db.room.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.hotel.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await db.$disconnect();
  });

  it('separates both owners, empty hold, cash at hotel, room block and later refund', async () => {
    const a = await service.get(id('owner-a'), query);
    const b = await service.get(id('owner-b'), query);
    expect(a.summary).toMatchObject({
      bookedValue: 5100000,
      collected: 4400000,
      refunded: 400000,
      netCollected: 4000000,
      soldRoomNights: 5,
      sellableRoomNights: 8,
      adr: 1020000,
      bookingCount: 6,
      cancelledCount: 1,
    });
    expect(a.summary.occupancyPercent).toBe(62.5);
    expect(a.summary.cancellationPercent).toBeCloseTo(100 / 6, 4);
    expect(a.points.map((point) => point.netCollected)).toEqual([
      2000000, 2400000, -400000,
    ]);
    expect(a.rooms).toHaveLength(2);
    expect(b.summary.netCollected).toBe(5000000);
    await expect(
      service.get(id('owner-a'), { ...query, hotelId: id('hotel-b') }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.get(id('owner-a'), {
        ...query,
        hotelId: id('hotel-a1'),
        roomId: id('room-b'),
      }),
    ).rejects.toMatchObject({ status: 404 });
    const a1 = await service.get(id('owner-a'), {
      ...query,
      hotelId: id('hotel-a1'),
      roomId: id('room-a1'),
    });
    expect(a1.summary).toMatchObject({
      netCollected: 2500000,
      soldRoomNights: 4,
      sellableRoomNights: 5,
    });
  });
});
