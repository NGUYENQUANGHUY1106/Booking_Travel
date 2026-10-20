import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AddressesModule } from '../src/modules/addresses/addresses.module';
import { AdminModule } from '../src/modules/admin/admin.module';
import { BookingsModule } from '../src/modules/bookings/bookings.module';
import { HotelsModule } from '../src/modules/hotels/hotels.module';
import { RoomsModule } from '../src/modules/rooms/rooms.module';

const describeWithDatabase =
  process.env.RUN_DB_AUTH_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-AUTH-08 with seeded PostgreSQL', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let prisma: PrismaService;
  let users: Record<string, string>;
  let hotelA: string;
  let hotelB: string;
  let draftHotelB: string;
  let roomB: string;
  let roomA: string;
  let draftRoomB: string;
  let bookingA: string;
  let bookingB: string;

  const bearer = (email: string, extra?: Record<string, unknown>) => {
    const userId = users[email];
    if (!userId) throw new Error(`Missing seed user: ${email}`);
    return `Bearer ${jwt.sign({ sub: userId, ...extra })}`;
  };

  beforeAll(async () => {
    process.env.SKIP_DATABASE_CONNECT = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
          load: [configuration],
        }),
        DatabaseModule,
        AddressesModule,
        HotelsModule,
        RoomsModule,
        BookingsModule,
        AdminModule,
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
    const seededUsers = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'owner@bookingtravel.vn',
            'owner-b@bookingtravel.vn',
            'traveler@bookingtravel.vn',
            'traveler-b@bookingtravel.vn',
            'admin@bookingtravel.vn',
            'admin-limited@bookingtravel.vn',
          ],
        },
      },
      select: { id: true, email: true },
    });
    users = seededUsers.reduce<Record<string, string>>((byEmail, user) => {
      if (user.email) byEmail[user.email] = user.id;
      return byEmail;
    }, {});
    hotelA = (
      await prisma.hotel.findUniqueOrThrow({
        where: { slug: 'blue-horizon-my-khe-hotel' },
      })
    ).id;
    hotelB = (
      await prisma.hotel.findUniqueOrThrow({
        where: { slug: 'riverside-homestay-hoi-an' },
      })
    ).id;
    draftHotelB = (
      await prisma.hotel.findUniqueOrThrow({
        where: { slug: 'owner-b-private-draft' },
      })
    ).id;
    roomB = (
      await prisma.room.findUniqueOrThrow({
        where: { id: 'seed-room-riverside-garden-view' },
      })
    ).id;
    roomA = (
      await prisma.room.findUniqueOrThrow({
        where: { id: 'seed-room-deluxe-sea-view' },
      })
    ).id;
    draftRoomB = (
      await prisma.room.findUniqueOrThrow({
        where: { id: 'seed-room-owner-b-draft' },
      })
    ).id;
    bookingA = (
      await prisma.booking.findUniqueOrThrow({ where: { code: 'BT-DEMO-001' } })
    ).id;
    bookingB = (
      await prisma.booking.findUniqueOrThrow({ where: { code: 'BT-DEMO-002' } })
    ).id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps public resources visible and private Owner B resources hidden', async () => {
    await request(app.getHttpServer()).get(`/api/hotels/${hotelB}`).expect(200);
    await request(app.getHttpServer())
      .get(`/api/hotels/${draftHotelB}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/hotels/${draftHotelB}`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/rooms/${draftRoomB}`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/hotels/${draftHotelB}`)
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/rooms/${draftRoomB}`)
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .expect(200);
  });

  it('blocks Owner A from listing or mutating Owner B resources', async () => {
    const ownerA = bearer('owner@bookingtravel.vn');
    const ownerAId = users['owner@bookingtravel.vn'];
    const ownerBId = users['owner-b@bookingtravel.vn'];
    const ownerAHotels = await request(app.getHttpServer())
      .get(`/api/hotels?ownerId=${ownerAId}`)
      .set('Authorization', ownerA)
      .expect(200);
    expect(
      (ownerAHotels.body as { id: string }[]).map((hotel) => hotel.id),
    ).toEqual([hotelA]);
    await request(app.getHttpServer())
      .get(`/api/hotels?ownerId=${ownerBId}`)
      .set('Authorization', ownerA)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/hotels/${hotelB}`)
      .set('Authorization', ownerA)
      .send({ name: 'Forbidden edit' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/hotels/${hotelB}`)
      .set('Authorization', ownerA)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/hotels/${hotelB}/rooms`)
      .set('Authorization', ownerA)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/rooms/${roomB}`)
      .set('Authorization', ownerA)
      .send({ quantity: 100, basePrice: 1 })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/rooms/${roomB}`)
      .set('Authorization', ownerA)
      .expect(403);

    const ownerBHotels = await request(app.getHttpServer())
      .get(`/api/hotels?ownerId=${ownerBId}`)
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .expect(200);
    expect(
      (ownerBHotels.body as { id: string }[]).map((hotel) => hotel.id),
    ).toEqual(expect.arrayContaining([hotelB, draftHotelB]));
    expect(
      (ownerBHotels.body as { id: string }[]).map((hotel) => hotel.id),
    ).not.toContain(hotelA);
  });

  it('scopes bookings separately for owners and travelers', async () => {
    const ownerA = bearer('owner@bookingtravel.vn');
    const ownerB = bearer('owner-b@bookingtravel.vn');
    const travelerA = bearer('traveler@bookingtravel.vn');
    const travelerB = bearer('traveler-b@bookingtravel.vn');
    await request(app.getHttpServer())
      .get(`/api/bookings/${bookingB}`)
      .set('Authorization', ownerA)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/bookings?hotelId=${hotelB}`)
      .set('Authorization', ownerA)
      .expect(403);
    const ownerAList = await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', ownerA)
      .expect(200);
    expect((ownerAList.body as { id: string }[]).map((b) => b.id)).toContain(
      bookingA,
    );
    expect(
      (ownerAList.body as { id: string }[]).map((b) => b.id),
    ).not.toContain(bookingB);
    await request(app.getHttpServer())
      .get(`/api/bookings/${bookingB}`)
      .set('Authorization', ownerB)
      .expect(200);
    const deniedBooking = await request(app.getHttpServer())
      .get(`/api/bookings/${bookingB}`)
      .set('Authorization', travelerA)
      .expect(403);
    expect(JSON.stringify(deniedBooking.body)).not.toContain(
      'traveler-b@bookingtravel.vn',
    );
    expect(JSON.stringify(deniedBooking.body)).not.toContain('BT-DEMO-002');
    await request(app.getHttpServer())
      .get(`/api/bookings?userId=${users['traveler-b@bookingtravel.vn']}`)
      .set('Authorization', travelerA)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/bookings/${bookingB}`)
      .set('Authorization', travelerB)
      .expect(200);
    const travelerAList = await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', travelerA)
      .expect(200);
    expect(
      (travelerAList.body as { id: string }[]).map((booking) => booking.id),
    ).toContain(bookingA);
    expect(
      (travelerAList.body as { id: string }[]).map((booking) => booking.id),
    ).not.toContain(bookingB);
  });

  it('denies cross-owner status updates and direct refund state changes', async () => {
    await request(app.getHttpServer())
      .patch(`/api/bookings/${bookingB}/status`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ status: 'CHECKED_IN' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/bookings/${bookingB}/status`)
      .set('Authorization', bearer('owner-b@bookingtravel.vn'))
      .send({ status: 'REFUNDED' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/bookings/${bookingB}/status`)
      .set('Authorization', bearer('admin@bookingtravel.vn'))
      .send({ status: 'REFUND_PENDING' })
      .expect(403);
  });

  it('does not let a traveler book a room from a private draft hotel', async () => {
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer('traveler@bookingtravel.vn'))
      .send({
        roomId: draftRoomB,
        checkIn: '2026-12-20',
        checkOut: '2026-12-22',
        adults: 2,
        guestName: 'Test Traveler',
        guestEmail: 'traveler@bookingtravel.vn',
      })
      .expect(404);
  });

  it('enforces Admin permissions loaded from the database', async () => {
    const limited = bearer('admin-limited@bookingtravel.vn', {
      permissions: ['USER_MANAGEMENT', 'BOOKING_SUPPORT'],
    });
    await request(app.getHttpServer())
      .get('/api/admins')
      .set('Authorization', limited)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/bookings/${bookingB}`)
      .set('Authorization', limited)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/hotels/${draftHotelB}`)
      .set('Authorization', limited)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admins')
      .set('Authorization', bearer('admin@bookingtravel.vn'))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/bookings/${bookingB}`)
      .set('Authorization', bearer('admin@bookingtravel.vn'))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/hotels/${draftHotelB}`)
      .set('Authorization', bearer('admin@bookingtravel.vn'))
      .expect(200);
  });

  it('keeps the personal address API available only to User and Owner roles', async () => {
    await request(app.getHttpServer()).get('/api/addresses').expect(401);
    await request(app.getHttpServer())
      .get('/api/addresses')
      .set('Authorization', bearer('traveler@bookingtravel.vn'))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/addresses')
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/addresses')
      .set('Authorization', bearer('admin-limited@bookingtravel.vn'))
      .expect(403);
  });

  it('rejects missing, invalid and tampered credentials', async () => {
    await request(app.getHttpServer()).get('/api/bookings').expect(401);
    await request(app.getHttpServer())
      .get('/api/bookings')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/admins')
      .set(
        'Authorization',
        bearer('traveler@bookingtravel.vn', { role: 'ADMIN' }),
      )
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/hotels/${hotelB}`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ ownerId: users['owner@bookingtravel.vn'] })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/api/hotels/no-such-hotel')
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ name: 'Missing' })
      .expect(404);
  });

  it('rejects mass assignment of owner, hotel and booking user IDs', async () => {
    await request(app.getHttpServer())
      .patch(`/api/hotels/${hotelA}`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ ownerId: users['owner-b@bookingtravel.vn'] })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/rooms/${roomA}`)
      .set('Authorization', bearer('owner@bookingtravel.vn'))
      .send({ hotelId: hotelB })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer('traveler@bookingtravel.vn'))
      .send({ userId: users['traveler-b@bookingtravel.vn'] })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/bookings')
      .set('Authorization', bearer('traveler@bookingtravel.vn'))
      .send({
        hotelId: hotelA,
        roomId: roomB,
        checkIn: '2026-12-20',
        checkOut: '2026-12-22',
        adults: 2,
        guestName: 'Test Traveler',
        guestEmail: 'traveler@bookingtravel.vn',
      })
      .expect(400);
  });
});
