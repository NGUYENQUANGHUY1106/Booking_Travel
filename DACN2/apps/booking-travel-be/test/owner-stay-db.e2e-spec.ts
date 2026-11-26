import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { BookingStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { BookingQrToken } from '../src/modules/bookings/booking-qr-token';
import { AdminBookingsService } from '../src/modules/bookings/admin-bookings.service';
import { BookingsModule } from '../src/modules/bookings/bookings.module';
import { AdminPaymentsService } from '../src/modules/payments/admin-payments.service';

const describeWithDatabase =
  process.env.RUN_DB_STAY_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-OWN-12 with PostgreSQL and HTTP guards', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  const userIds: Record<string, string> = {};
  const sessions: string[] = [];
  const bookingIds: string[] = [];
  let checkInCode: string;
  let checkOutCode: string;
  let checkInBookingId: string;
  let checkOutBookingId: string;
  let concurrentBookingId: string;
  let concurrentCode: string;
  let staleBookingId: string;
  let staleCode: string;
  let hotelId: string;
  let today: string;
  let tomorrow: string;

  const bearer = (email: string) =>
    `Bearer ${jwt.sign({ sub: userIds[email], sessionId: sessions[Object.keys(userIds).indexOf(email)] })}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
          load: [configuration],
        }),
        DatabaseModule,
        BookingsModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
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

    const emails = [
      'owner@bookingtravel.vn',
      'owner-b@bookingtravel.vn',
      'traveler@bookingtravel.vn',
    ];
    for (const email of emails) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { email },
        select: { id: true },
      });
      userIds[email] = user.id;
      const sessionId = `stay-e2e-${randomUUID()}`;
      sessions.push(sessionId);
      await prisma.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash: sessionId,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
    }

    const hotel = await prisma.hotel.findUniqueOrThrow({
      where: { slug: 'blue-horizon-my-khe-hotel' },
      select: { id: true, name: true },
    });
    hotelId = hotel.id;
    const room = await prisma.room.findFirstOrThrow({
      where: { hotelId },
      select: { id: true, name: true, type: true },
    });
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const part = (type: string) =>
      parts.find((item) => item.type === type)?.value ?? '';
    today = `${part('year')}-${part('month')}-${part('day')}`;
    const todayDate = new Date(`${today}T00:00:00Z`);
    tomorrow = new Date(todayDate.getTime() + 86_400_000)
      .toISOString()
      .slice(0, 10);
    const yesterday = new Date(todayDate.getTime() - 86_400_000)
      .toISOString()
      .slice(0, 10);

    async function createStay(
      code: string,
      checkIn: string,
      checkOut: string,
      status: BookingStatus,
    ) {
      return prisma.booking.create({
        data: {
          code,
          userId: userIds['traveler@bookingtravel.vn'],
          hotelId,
          roomId: room.id,
          hotelNameSnapshot: hotel.name,
          hotelAddressSnapshot: 'Test',
          roomNameSnapshot: room.name,
          roomTypeSnapshot: room.type,
          checkIn: new Date(`${checkIn}T00:00:00Z`),
          checkOut: new Date(`${checkOut}T00:00:00Z`),
          checkInTimeSnapshot: '00:00',
          checkOutTimeSnapshot: '23:59',
          adults: 1,
          children: 0,
          roomCount: 1,
          nights: 1,
          pricePerNight: '100000',
          totalAmount: '100000',
          status,
          guestName: 'Khách kiểm thử',
          guestEmail: 'stay-fixture@example.com',
          ...(status === BookingStatus.CHECKED_IN
            ? { actualCheckInAt: new Date() }
            : {}),
        },
      });
    }
    checkInCode = `BT-${randomUUID().slice(0, 8).toUpperCase()}`;
    checkOutCode = `BT-${randomUUID().slice(0, 8).toUpperCase()}`;
    concurrentCode = `BT-${randomUUID().slice(0, 8).toUpperCase()}`;
    staleCode = `BT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const first = await createStay(
      checkInCode,
      today,
      tomorrow,
      BookingStatus.CONFIRMED,
    );
    const second = await createStay(
      checkOutCode,
      yesterday,
      today,
      BookingStatus.CHECKED_IN,
    );
    const concurrent = await createStay(
      concurrentCode,
      today,
      tomorrow,
      BookingStatus.CONFIRMED,
    );
    const stale = await createStay(
      staleCode,
      today,
      tomorrow,
      BookingStatus.CONFIRMED,
    );
    checkInBookingId = first.id;
    checkOutBookingId = second.id;
    concurrentBookingId = concurrent.id;
    staleBookingId = stale.id;
    bookingIds.push(first.id, second.id, concurrent.id, stale.id);
  });

  afterAll(async () => {
    if (prisma && bookingIds.length) {
      await prisma.bookingStayTransition.deleteMany({
        where: { bookingId: { in: bookingIds } },
      });
      await prisma.payment.deleteMany({
        where: { bookingId: { in: bookingIds } },
      });
      await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    }
    if (prisma && sessions.length)
      await prisma.authSession.deleteMany({ where: { id: { in: sessions } } });
    await app?.close();
  });

  it('keeps verify read-only, hides cross-hotel PII, and rejects unauthenticated or traveler calls', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/owner/bookings/verify')
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ bookingCode: checkInCode })
      .expect(201);
    expect(response.body).toMatchObject({
      booking: { id: checkInBookingId, code: checkInCode },
      eligibility: { eligible: true },
    });
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: checkInBookingId },
        })
      ).status,
    ).toBe(BookingStatus.CONFIRMED);
    await request(app.getHttpServer())
      .post('/api/owner/bookings/verify')
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .send({ bookingCode: checkInCode })
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/owner/bookings/verify')
      .set('Authorization', bearer('traveler@bookingtravel.vn'))
      .send({ bookingCode: checkInCode })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/owner/bookings/verify')
      .send({ bookingCode: checkInCode })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/owner/bookings/${checkInBookingId}/check-in`)
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .send({
        bookingCode: checkInCode,
        verificationRef: 'invalid.verification.reference.value',
        idempotencyKey: 'request_cross_hotel_123456',
        confirmed: true,
      })
      .expect(404);
  });

  it('checks in with a signed QR once, then returns the same transition for a repeated key', async () => {
    const admin = {
      id: 'seed-user-admin',
      role: 'ADMIN' as const,
      permissions: ['BOOKING_SUPPORT'],
    };
    const adminPayments = new AdminPaymentsService(prisma);
    const adminBookings = app.get(AdminBookingsService);
    const before = await adminPayments.summary(admin);
    const beforeProperty = before.find((item) => item.currency === 'VND');
    const qr = new BookingQrToken().issue({
      bookingId: checkInBookingId,
      bookingCode: checkInCode,
      hotelId,
      checkIn: today,
      checkOut: tomorrow,
    }).value;
    const verified = await request(app.getHttpServer())
      .post('/api/owner/bookings/verify')
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ qrToken: qr })
      .expect(201);
    const verificationRef = (verified.body as { verificationRef: string })
      .verificationRef;
    const body = {
      qrToken: qr,
      verificationRef,
      idempotencyKey: `stay_${randomUUID().replace(/-/g, '')}`,
      confirmed: true,
      confirmedCollection: true,
      collectedAmount: '100000',
      collectionMethod: 'CASH',
    };
    await request(app.getHttpServer())
      .post(`/api/owner/bookings/${checkInBookingId}/check-in`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({
        ...body,
        confirmedCollection: undefined,
        collectedAmount: undefined,
        collectionMethod: undefined,
      })
      .expect(400);
    const first = await request(app.getHttpServer())
      .post(`/api/owner/bookings/${checkInBookingId}/check-in`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send(body)
      .expect(201);
    expect(first.body).toMatchObject({
      status: BookingStatus.CHECKED_IN,
      replayed: false,
    });
    const firstTime = (first.body as { happenedAt: string }).happenedAt;
    const repeat = await request(app.getHttpServer())
      .post(`/api/owner/bookings/${checkInBookingId}/check-in`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send(body)
      .expect(201);
    expect(repeat.body).toMatchObject({
      replayed: true,
      happenedAt: firstTime,
    });
    const saved = await prisma.booking.findUniqueOrThrow({
      where: { id: checkInBookingId },
    });
    expect(saved.actualCheckInAt?.toISOString()).toBe(firstTime);
    expect(saved.paymentMethod).toBe('PAY_AT_HOTEL');
    expect(
      await prisma.payment.count({
        where: {
          bookingId: checkInBookingId,
          status: 'PAID',
          method: 'PAY_AT_HOTEL',
        },
      }),
    ).toBe(1);
    expect(
      await prisma.bookingStayTransition.count({
        where: { bookingId: checkInBookingId, action: 'CHECK_IN' },
      }),
    ).toBe(1);
    const paid = await adminPayments.list(admin, {
      status: 'PAID',
      search: checkInCode,
      page: 1,
      limit: 20,
      sort: 'newest',
      scope: 'all',
    });
    expect(paid.items).toEqual([
      expect.objectContaining({
        bookingId: checkInBookingId,
        method: 'PAY_AT_HOTEL',
        status: 'PAID',
        amount: '100000',
        collectedById: userIds['owner@bookingtravel.vn'],
      }),
    ]);
    const collectedBookings = await adminBookings.list(admin, {
      paymentStatus: 'PAID',
      search: checkInCode,
      dateField: 'createdAt',
      page: 1,
      limit: 20,
      sort: 'newest',
    });
    expect(collectedBookings.items).toEqual([
      expect.objectContaining({
        id: checkInBookingId,
        paymentMethod: 'PAY_AT_HOTEL',
        paymentStatus: 'PAID',
      }),
    ]);
    const after = await adminPayments.summary(admin);
    const afterProperty = after.find((item) => item.currency === 'VND');
    expect(
      Number(afterProperty?.collectedAtProperty ?? 0) -
        Number(beforeProperty?.collectedAtProperty ?? 0),
    ).toBe(100000);
    await request(app.getHttpServer())
      .post(`/api/owner/bookings/${checkInBookingId}/check-in`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({
        ...body,
        idempotencyKey: `stay_${randomUUID().replace(/-/g, '')}`,
      })
      .expect(409);
  });

  it('checks out a previously checked-in booking, exposing COMPLETED to the traveler', async () => {
    const preview = await request(app.getHttpServer())
      .get(`/api/owner/bookings/${checkOutBookingId}/check-out-preview`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .expect(200);
    expect(preview.body).toMatchObject({
      booking: { id: checkOutBookingId },
      eligibility: { eligible: true },
    });
    await request(app.getHttpServer())
      .get(`/api/owner/bookings/${checkOutBookingId}/check-out-preview`)
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .expect(404);
    const body = {
      idempotencyKey: `stay_${randomUUID().replace(/-/g, '')}`,
      confirmed: true,
    };
    const result = await request(app.getHttpServer())
      .post(`/api/owner/bookings/${checkOutBookingId}/check-out`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send(body)
      .expect(201);
    expect(result.body).toMatchObject({
      status: BookingStatus.COMPLETED,
      replayed: false,
    });
    const saved = await prisma.booking.findUniqueOrThrow({
      where: { id: checkOutBookingId },
    });
    expect(saved.actualCheckOutAt?.toISOString()).toBe(
      (result.body as { happenedAt: string }).happenedAt,
    );
    expect(
      await prisma.bookingStayTransition.count({
        where: { bookingId: checkOutBookingId, action: 'CHECK_OUT' },
      }),
    ).toBe(1);
    const travelerView = await request(app.getHttpServer())
      .get(`/api/bookings/${checkOutBookingId}`)
      .set('Authorization', bearer('traveler@bookingtravel.vn'))
      .expect(200);
    expect(travelerView.body).toMatchObject({
      status: BookingStatus.COMPLETED,
    });
    await request(app.getHttpServer())
      .post(`/api/owner/bookings/${checkOutBookingId}/check-out`)
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .send(body)
      .expect(404);
  });

  it('requires Owner confirmation before marking an old checked-in booking paid', async () => {
    const url = `/api/owner/bookings/${checkOutBookingId}/confirm-property-collection`;
    const body = {
      confirmedCollection: true,
      collectedAmount: '100000',
      collectionMethod: 'CASH',
      idempotencyKey: `collect_${randomUUID().replace(/-/g, '')}`,
    };
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .send(body)
      .expect(404);
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send(body)
      .expect(201);
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send(body)
      .expect(201);
    expect(
      await prisma.payment.count({
        where: { bookingId: checkOutBookingId, status: 'PAID' },
      }),
    ).toBe(1);
    const view = await request(app.getHttpServer())
      .get(`/api/bookings/${checkOutBookingId}`)
      .set('Authorization', bearer('traveler@bookingtravel.vn'))
      .expect(200);
    expect(view.body).toMatchObject({
      latestPayment: { status: 'PAID', method: 'PAY_AT_HOTEL' },
    });
  });

  it('allows only one of two concurrent check-ins and stores one audit event', async () => {
    const verified = await request(app.getHttpServer())
      .post('/api/owner/bookings/verify')
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ bookingCode: concurrentCode })
      .expect(201);
    const verificationRef = (verified.body as { verificationRef: string })
      .verificationRef;
    const send = (key: string) =>
      request(app.getHttpServer())
        .post(`/api/owner/bookings/${concurrentBookingId}/check-in`)
        .set('Authorization', bearer('owner@bookingtravel.vn'))
        .send({
          bookingCode: concurrentCode,
          verificationRef,
          confirmed: true,
          confirmedCollection: true,
          collectedAmount: '100000',
          collectionMethod: 'CASH',
          idempotencyKey: key,
        });
    const [a, b] = await Promise.all([
      send(`stay_${randomUUID().replace(/-/g, '')}`),
      send(`stay_${randomUUID().replace(/-/g, '')}`),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(
      await prisma.bookingStayTransition.count({
        where: { bookingId: concurrentBookingId },
      }),
    ).toBe(2);
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: concurrentBookingId },
        })
      ).status,
    ).toBe(BookingStatus.CHECKED_IN);
  });

  it('rejects a verification when the booking is cancelled before confirmation', async () => {
    const verified = await request(app.getHttpServer())
      .post('/api/owner/bookings/verify')
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ bookingCode: staleCode })
      .expect(201);
    await prisma.booking.update({
      where: { id: staleBookingId },
      data: { status: BookingStatus.CANCELLED },
    });
    await request(app.getHttpServer())
      .post(`/api/owner/bookings/${staleBookingId}/check-in`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({
        bookingCode: staleCode,
        verificationRef: (verified.body as { verificationRef: string })
          .verificationRef,
        confirmed: true,
        idempotencyKey: `stay_${randomUUID().replace(/-/g, '')}`,
      })
      .expect(409);
    expect(
      await prisma.bookingStayTransition.count({
        where: { bookingId: staleBookingId },
      }),
    ).toBe(0);
  });
});
