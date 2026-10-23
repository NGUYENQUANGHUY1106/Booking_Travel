import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { HotelStatus, RoomStatus, UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { AdminModule } from '../src/modules/admin/admin.module';
import { BookingsModule } from '../src/modules/bookings/bookings.module';
import { HotelsModule } from '../src/modules/hotels/hotels.module';
import { RoomsModule } from '../src/modules/rooms/rooms.module';

describe('ST-AUTH-08 request pipeline', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let prisma: {
    user: { findUnique: jest.Mock };
    authSession: { findFirst: jest.Mock };
    hotel: { findFirst: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock };
    room: { findFirst: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock };
    booking: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    adminProfile: { findMany: jest.Mock };
  };

  const users = {
    traveler: {
      id: 'traveler',
      role: UserRole.USER,
      isActive: true,
      status: UserStatus.ACTIVE,
      adminProfile: null,
    },
    ownerA: {
      id: 'owner-a',
      role: UserRole.HOTEL_OWNER,
      isActive: true,
      status: UserStatus.ACTIVE,
      adminProfile: null,
      ownerApplication: { status: 'VERIFIED' },
      ownerProfile: { isActive: true },
    },
    ownerB: {
      id: 'owner-b',
      role: UserRole.HOTEL_OWNER,
      isActive: true,
      status: UserStatus.ACTIVE,
      adminProfile: null,
      ownerApplication: { status: 'VERIFIED' },
      ownerProfile: { isActive: true },
    },
    admin: {
      id: 'admin',
      role: UserRole.ADMIN,
      isActive: true,
      status: UserStatus.ACTIVE,
      adminProfile: { permissions: ['USER_MANAGEMENT', 'BOOKING_SUPPORT'] },
    },
    limitedAdmin: {
      id: 'limited-admin',
      role: UserRole.ADMIN,
      isActive: true,
      status: UserStatus.ACTIVE,
      adminProfile: { permissions: [] },
    },
    disabledOwner: {
      id: 'disabled-owner',
      role: UserRole.HOTEL_OWNER,
      isActive: false,
      status: UserStatus.DISABLED,
      adminProfile: null,
    },
  };
  const hotels = {
    'hotel-a': {
      id: 'hotel-a',
      ownerId: 'owner-a',
      status: HotelStatus.APPROVED,
      deletedAt: null,
      name: 'Hotel A',
      rooms: [],
      owner: { id: 'owner-a', fullName: 'Owner A' },
    },
    'hotel-b': {
      id: 'hotel-b',
      ownerId: 'owner-b',
      status: HotelStatus.DRAFT,
      deletedAt: null,
      name: 'Hotel B',
      rooms: [],
      owner: { id: 'owner-b', fullName: 'Owner B' },
    },
  };
  const rooms = {
    'room-b': {
      id: 'room-b',
      hotelId: 'hotel-b',
      status: RoomStatus.ACTIVE,
      deletedAt: null,
      hotel: { ownerId: 'owner-b', status: HotelStatus.DRAFT, deletedAt: null },
    },
  };
  const bookings = {
    'booking-b': {
      id: 'booking-b',
      userId: 'traveler',
      hotelId: 'hotel-b',
      hotel: { ownerId: 'owner-b' },
    },
  };

  const token = (sub: string, extra?: Record<string, unknown>) =>
    jwt.sign({ sub, sessionId: `session-${sub}`, ...extra });
  const bearer = (sub: string, extra?: Record<string, unknown>) =>
    `Bearer ${token(sub, extra)}`;

  beforeAll(async () => {
    process.env.SKIP_DATABASE_CONNECT = 'true';
    prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          Promise.resolve(
            Object.values(users).find((user) => user.id === where.id) ?? null,
          ),
        ),
      },
      authSession: {
        findFirst: jest.fn(() =>
          Promise.resolve({
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
          }),
        ),
      },
      hotel: {
        findFirst: jest.fn(
          ({ where }: { where: { id: keyof typeof hotels } }) =>
            Promise.resolve(hotels[where.id] ?? null),
        ),
        findMany: jest.fn(
          ({ where }: { where: { ownerId?: string; status?: HotelStatus } }) =>
            Promise.resolve(
              Object.values(hotels).filter(
                (hotel) =>
                  (!where.ownerId || hotel.ownerId === where.ownerId) &&
                  (!where.status || hotel.status === where.status),
              ),
            ),
        ),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      room: {
        findFirst: jest.fn(({ where }: { where: { id: keyof typeof rooms } }) =>
          Promise.resolve(rooms[where.id] ?? null),
        ),
        findMany: jest.fn(() => Promise.resolve([])),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      booking: {
        findUnique: jest.fn(
          ({ where }: { where: { id: keyof typeof bookings } }) =>
            Promise.resolve(bookings[where.id] ?? null),
        ),
        findFirst: jest.fn(
          ({ where }: { where: { id: keyof typeof bookings } }) =>
            Promise.resolve(bookings[where.id] ?? null),
        ),
        findMany: jest.fn(() => Promise.resolve([])),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      adminProfile: { findMany: jest.fn(() => Promise.resolve([])) },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ auth: { accessSecret: 'test-access-secret' } })],
        }),
        DatabaseModule,
        HotelsModule,
        RoomsModule,
        BookingsModule,
        AdminModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps approved hotels public and protects draft hotels', async () => {
    const list = await request(app.getHttpServer()).get('/hotels').expect(200);
    const hotelResults = list.body as { id: string }[];
    expect(hotelResults.map((hotel) => hotel.id)).toEqual(['hotel-a']);

    await request(app.getHttpServer()).get('/hotels/hotel-b').expect(403);
    await request(app.getHttpServer())
      .get('/hotels/hotel-b')
      .set('Authorization', bearer('owner-b'))
      .expect(200);
  });

  it('returns 401 for absent, invalid, expired, and inactive credentials', async () => {
    await request(app.getHttpServer()).post('/hotels').send({}).expect(401);
    await request(app.getHttpServer())
      .post('/hotels')
      .set('Authorization', 'Bearer invalid')
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/hotels')
      .set(
        'Authorization',
        `Bearer ${jwt.sign({ sub: 'owner-a' }, { expiresIn: -1 })}`,
      )
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/hotels')
      .set('Authorization', bearer('deleted-user'))
      .send({})
      .expect(401);
    await request(app.getHttpServer())
      .post('/hotels')
      .set('Authorization', bearer('disabled-owner'))
      .send({})
      .expect(401);
  });

  it('ignores role claims and denies user access to owner and admin routes', async () => {
    await request(app.getHttpServer())
      .patch('/hotels/hotel-a')
      .set(
        'Authorization',
        bearer('traveler', { roles: ['ADMIN', 'HOTEL_OWNER'] }),
      )
      .send({ name: 'Attack' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/admins')
      .set('Authorization', bearer('traveler'))
      .expect(403);
    expect(prisma.hotel.updateMany).not.toHaveBeenCalled();
  });

  it('rejects cross-owner hotel and room mutations before domain services run', async () => {
    await request(app.getHttpServer())
      .patch('/hotels/hotel-b')
      .set('Authorization', bearer('owner-a'))
      .send({ name: 'Attack' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/rooms/room-b')
      .set('Authorization', bearer('owner-a'))
      .send({ name: 'Attack' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/hotels/hotel-b/rooms')
      .set('Authorization', bearer('owner-a'))
      .send({})
      .expect(403);
    expect(prisma.hotel.updateMany).not.toHaveBeenCalled();
    expect(prisma.room.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 when an owner requests a missing resource', async () => {
    await request(app.getHttpServer())
      .patch('/hotels/unknown')
      .set('Authorization', bearer('owner-a'))
      .send({ name: 'Unknown' })
      .expect(404);
  });

  it('allows owner mutations with an ownership-constrained database update', async () => {
    await request(app.getHttpServer())
      .patch('/hotels/hotel-a')
      .set('Authorization', bearer('owner-a'))
      .send({ name: 'Hotel A Updated' })
      .expect(200);
    expect(prisma.hotel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hotel-a', ownerId: 'owner-a', deletedAt: null },
      }),
    );
  });

  it('scopes booking lists and rejects cross-owner booking detail', async () => {
    await request(app.getHttpServer())
      .get('/bookings?hotelId=hotel-b')
      .set('Authorization', bearer('owner-a'))
      .expect(403);
    await request(app.getHttpServer())
      .get('/bookings/booking-b')
      .set('Authorization', bearer('owner-a'))
      .expect(403);
    await request(app.getHttpServer())
      .get('/bookings?userId=someone-else')
      .set('Authorization', bearer('traveler'))
      .expect(403);
    await request(app.getHttpServer())
      .get('/bookings')
      .set('Authorization', bearer('owner-a'))
      .expect(200);
    const calls = prisma.booking.findMany.mock.calls as unknown as Array<
      [{ where: { hotel: { ownerId: string } } }]
    >;
    expect(calls[0][0].where.hotel.ownerId).toBe('owner-a');
  });

  it('requires an explicit admin permission and rejects permission escalation', async () => {
    await request(app.getHttpServer())
      .get('/admins')
      .set('Authorization', bearer('limited-admin'))
      .expect(403);
    await request(app.getHttpServer())
      .get('/admins')
      .set('Authorization', bearer('admin'))
      .expect(200);
    await request(app.getHttpServer())
      .post('/admins')
      .set('Authorization', bearer('admin'))
      .send({ userId: 'owner-a', permissions: ['UNKNOWN_POWER'] })
      .expect(403);
  });

  it('rejects ownerId and userId mass assignment at request validation', async () => {
    await request(app.getHttpServer())
      .patch('/hotels/hotel-a')
      .set('Authorization', bearer('owner-a'))
      .send({ ownerId: 'owner-b' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/bookings')
      .set('Authorization', bearer('traveler'))
      .send({ userId: 'owner-b' })
      .expect(400);
  });
});
