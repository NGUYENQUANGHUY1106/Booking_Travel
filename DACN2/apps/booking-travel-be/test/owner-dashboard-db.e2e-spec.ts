import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { HotelOwnersModule } from '../src/modules/hotel-owners/hotel-owners.module';
import {
  OWNER_DASHBOARD_CLOCK,
  OwnerDashboardService,
} from '../src/modules/hotel-owners/owner-dashboard.service';

type DashboardResponse = Awaited<
  ReturnType<OwnerDashboardService['dashboard']>
>;

const describeWithDatabase =
  process.env.RUN_DB_OWNER_E2E === '1' ? describe : describe.skip;
describeWithDatabase('ST-OWN-03 real PostgreSQL / JWT ownership', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  const users = Array.from({ length: 5 }, () => randomUUID());
  const sessions = users.map(() => randomUUID());
  const hotels = users.map(() => randomUUID());
  const rooms = users.map(() => randomUUID());
  const now = new Date('2026-10-31T17:15:00Z');
  const query = {
    dateFrom: '2026-11-01',
    dateTo: '2026-11-01',
    timeZone: 'Asia/Ho_Chi_Minh',
  };
  const token = (i: number) =>
    `Bearer ${jwt.sign({ sub: users[i], sessionId: sessions[i] })}`;
  const get = (i: number, extra = {}) =>
    request(app.getHttpServer())
      .get('/api/owner/dashboard')
      .query({ ...query, ...extra })
      .set('Authorization', token(i));

  beforeAll(async () => {
    process.env.SKIP_DATABASE_CONNECT = 'false';
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
          load: [configuration],
        }),
        DatabaseModule,
        HotelOwnersModule,
      ],
    })
      .overrideProvider(OWNER_DASHBOARD_CLOCK)
      .useValue(() => now)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    for (let i = 0; i < users.length; i++) {
      await prisma.user.create({
        data: {
          id: users[i],
          email: `${users[i]}@example.invalid`,
          fullName: 'Dashboard QA',
          passwordHash: 'unused',
          role: i === 2 ? 'USER' : 'HOTEL_OWNER',
          status: 'ACTIVE',
          isActive: true,
          ...(i === 2 || i === 3
            ? {}
            : {
                ownerProfile: { create: { verifiedAt: now } },
                ownerApplication: { create: { status: 'VERIFIED' } },
              }),
        },
      });
      await prisma.authSession.create({
        data: {
          id: sessions[i],
          userId: users[i],
          refreshTokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
    }
    // A owns approved + draft + deleted + empty hotels. B owns a private hotel.
    for (let i = 0; i < hotels.length; i++) {
      await prisma.hotel.create({
        data: {
          id: hotels[i],
          ownerId: i === 2 ? users[1] : users[0],
          name: `Hotel ${i}`,
          slug: hotels[i],
          addressLine: 'QA',
          city: 'QA',
          province: 'QA',
          status: i === 0 ? 'APPROVED' : 'DRAFT',
          deletedAt: i === 3 ? now : null,
        },
      });
      await prisma.room.create({
        data: {
          id: rooms[i],
          hotelId: hotels[i],
          name: 'Room',
          type: 'DELUXE',
          bedInfo: 'Double',
          basePrice: 500000,
          quantity: i === 1 ? 2 : 1,
        },
      });
    }
    const booking = async (
      hotelIndex: number,
      createdAt: string,
      status: BookingStatus,
      checkIn: string,
      checkOut: string,
    ) =>
      prisma.booking.create({
        data: {
          code: randomUUID(),
          userId: users[2],
          hotelId: hotels[hotelIndex],
          roomId: rooms[hotelIndex],
          createdAt: new Date(createdAt),
          status,
          checkIn: new Date(checkIn),
          checkOut: new Date(checkOut),
          adults: 2,
          children: 1,
          roomCount: 2,
          nights: 2,
          pricePerNight: 500000,
          totalAmount: 2000000,
          guestName: 'Private guest',
          guestEmail: 'private-guest@example.invalid',
        },
      });
    await booking(
      0,
      '2026-10-31T16:59:59.999Z',
      'CONFIRMED',
      '2026-11-01',
      '2026-11-03',
    );
    await booking(
      0,
      '2026-10-31T17:00:00Z',
      'CANCELLED',
      '2026-11-01',
      '2026-11-03',
    );
    await booking(
      0,
      '2026-11-01T16:59:59.999Z',
      'CHECKED_IN',
      '2026-10-30',
      '2026-11-01',
    );
    await booking(
      0,
      '2026-11-01T17:00:00Z',
      'CHECKED_IN',
      '2026-11-01',
      '2026-11-03',
    );
    await booking(
      1,
      '2026-10-31T18:00:00Z',
      'CONFIRMED',
      '2026-11-02',
      '2026-11-04',
    );
    await booking(
      2,
      '2026-10-31T18:00:00Z',
      'CONFIRMED',
      '2026-11-01',
      '2026-11-03',
    );
    await booking(
      3,
      '2026-10-31T18:00:00Z',
      'CONFIRMED',
      '2026-11-01',
      '2026-11-03',
    );
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.booking.deleteMany({ where: { hotelId: { in: hotels } } });
      await prisma.room.deleteMany({ where: { hotelId: { in: hotels } } });
      await prisma.hotel.deleteMany({ where: { id: { in: hotels } } });
      await prisma.hotelOwnerProfile.deleteMany({
        where: { userId: { in: users } },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    await app?.close();
  });
  it('requires a live verified Owner and rejects spoofed ownership filters', async () => {
    await request(app.getHttpServer())
      .get('/api/owner/dashboard')
      .query(query)
      .expect(401);
    await get(2).expect(403);
    await get(3).expect(403);
    await get(0, { ownerId: users[1] }).expect(400);
    await get(0, { hotelId: hotels[2] }).expect(404);
    await get(0, { hotelId: hotels[3] }).expect(404);
    await get(0, { hotelId: randomUUID() }).expect(404);
  });
  it('aggregates only A including nonpublic hotels and excludes deleted hotels / B', async () => {
    const response = await get(0).expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toMatchObject({
      scope: { hotelCount: 3, today: '2026-11-01' },
      bookings: { count: 3, previousCount: 1, difference: 2 },
      summary: { roomCount: 4, upcomingBookings: 1, currentGuests: 3 },
      actions: { arrivals: 1, departures: 1 },
      updatedAt: now.toISOString(),
    });
    expect(JSON.stringify(response.body)).not.toContain('private-guest');
    expect(
      (
        (await get(0, { hotelId: hotels[0] }).expect(200))
          .body as DashboardResponse
      ).bookings.count,
    ).toBe(2);
    expect(
      (
        (await get(0, { hotelId: hotels[1] }).expect(200))
          .body as DashboardResponse
      ).bookings.count,
    ).toBe(1);
    expect(
      ((await get(1).expect(200)).body as DashboardResponse).bookings.count,
    ).toBe(1);
  });
  it('distinguishes empty hotels, no hotels and unavailable dependencies', async () => {
    const empty = (await get(0, { hotelId: hotels[4] }).expect(200))
      .body as DashboardResponse;
    expect(empty.scope.hotelCount).toBe(1);
    expect(empty.bookings.count).toBe(0);
    expect(empty.occupancy).toMatchObject({
      availability: 'unavailable',
      percentage: null,
      sellableRoomNights: null,
    });
    expect(empty.revenue.amount).toBeNull();
    expect(empty.revenueSeries.points).toBeNull();
    expect(empty.rating.score).toBeNull();
    expect((await get(4).expect(200)).body).toMatchObject({
      scope: { hotelCount: 0 },
      bookings: { count: 0, previousCount: 0, difference: 0 },
    });
  });
  it('paginates only owned hotels; rejects invalid reporting inputs', async () => {
    const all: string[] = [];
    let after: string | null = null;
    do {
      const response = await request(app.getHttpServer())
        .get('/api/owner/dashboard/hotels')
        .query({ limit: 1, ...(after ? { after } : {}) })
        .set('Authorization', token(0))
        .expect(200);
      const body = response.body as {
        items: { id: string }[];
        nextCursor: string | null;
      };
      all.push(...body.items.map((hotel) => hotel.id));
      after = body.nextCursor;
    } while (after);
    expect(all.sort()).toEqual([hotels[0], hotels[1], hotels[4]].sort());
    await get(0, { dateFrom: '2026-02-30' }).expect(400);
    await get(0, { dateTo: '2026-10-31' }).expect(400);
    await get(0, { timeZone: 'UTC' }).expect(400);
    await request(app.getHttpServer())
      .get('/api/owner/dashboard/hotels')
      .query({ limit: 101 })
      .set('Authorization', token(0))
      .expect(400);
  });
  it('immediately denies suspended verification, blocked account and revoked session', async () => {
    await prisma.hotelOwnerApplication.update({
      where: { userId: users[1] },
      data: { status: 'SUSPENDED' },
    });
    await get(1).expect(403);
    await prisma.user.update({
      where: { id: users[4] },
      data: { isActive: false },
    });
    await get(4).expect(401);
    await prisma.authSession.update({
      where: { id: sessions[0] },
      data: { revokedAt: new Date() },
    });
    await get(0).expect(401);
  });
});
