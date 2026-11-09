import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { HotelStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { HotelsModule } from '../src/modules/hotels/hotels.module';

const describeWithDatabase =
  process.env.RUN_DB_HOTEL_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-OWN-04 owner hotel profile with PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let ownerA: string;
  let ownerB: string;
  let traveler: string;
  const createdHotelIds: string[] = [];
  const sessionIds: string[] = [];

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
        HotelsModule,
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
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'owner@bookingtravel.vn',
            'owner-b@bookingtravel.vn',
            'traveler@bookingtravel.vn',
          ],
        },
      },
      select: { id: true, email: true },
    });
    const byEmail = users.reduce<Record<string, string>>((result, user) => {
      if (user.email) result[user.email] = user.id;
      return result;
    }, {});
    for (const email of [
      'owner@bookingtravel.vn',
      'owner-b@bookingtravel.vn',
      'traveler@bookingtravel.vn',
    ]) {
      if (!byEmail[email])
        throw new Error(
          `Thiếu tài khoản seed: ${email}. Chạy npm.cmd run db:setup.`,
        );
    }
    const makeBearer = async (email: string) => {
      const userId = byEmail[email];
      const sessionId = `owner-hotel-e2e-${Date.now()}-${userId}`;
      sessionIds.push(sessionId);
      await prisma.authSession.create({
        data: {
          id: sessionId,
          userId,
          refreshTokenHash: sessionId,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      return `Bearer ${jwt.sign({ sub: userId, sessionId })}`;
    };
    ownerA = await makeBearer('owner@bookingtravel.vn');
    ownerB = await makeBearer('owner-b@bookingtravel.vn');
    traveler = await makeBearer('traveler@bookingtravel.vn');
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.booking.deleteMany({
        where: { hotelId: { in: createdHotelIds } },
      });
      await prisma.room.deleteMany({
        where: { hotelId: { in: createdHotelIds } },
      });
      await prisma.hotel.deleteMany({ where: { id: { in: createdHotelIds } } });
      await prisma.authSession.deleteMany({
        where: { id: { in: sessionIds } },
      });
    }
    await app?.close();
  });

  const create = async (
    bearer: string,
    key: string,
    name = 'Hồ sơ kiểm thử',
  ) => {
    const response = await request(app.getHttpServer())
      .post('/api/owner/hotels')
      .set('Authorization', bearer)
      .send({ clientDraftId: key, name, accommodationType: 'RESORT' })
      .expect(201);
    const hotel = response.body as {
      id: string;
      status: string;
      profileVersion: number;
      ownerId: string;
    };
    if (!createdHotelIds.includes(hotel.id)) createdHotelIds.push(hotel.id);
    return hotel;
  };

  it('creates one draft per owner and idempotency key, with no fabricated location', async () => {
    const key = `own04_${Date.now()}_same`;
    const [first, second] = await Promise.all([
      create(ownerA, key),
      create(ownerA, key),
    ]);
    expect(first.id).toBe(second.id);
    expect(first.status).toBe('DRAFT');
    expect(first.profileVersion).toBe(1);
    const stored = await prisma.hotel.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(stored.addressLine).toBeNull();
    expect(stored.city).toBeNull();
    expect(stored.province).toBeNull();
    const otherOwner = await create(ownerB, key, 'Hồ sơ chủ B');
    expect(otherOwner.id).not.toBe(first.id);
    expect(otherOwner.ownerId).not.toBe(first.ownerId);
  });

  it('scopes list and detail to the owner, and hides drafts from the public', async () => {
    const hotel = await create(ownerA, `own04_${Date.now()}_scope`);
    const listA = await request(app.getHttpServer())
      .get('/api/owner/hotels')
      .set('Authorization', ownerA)
      .expect(200);
    const listB = await request(app.getHttpServer())
      .get('/api/owner/hotels')
      .set('Authorization', ownerB)
      .expect(200);
    expect((listA.body as { id: string }[]).map((item) => item.id)).toContain(
      hotel.id,
    );
    expect(
      (listB.body as { id: string }[]).map((item) => item.id),
    ).not.toContain(hotel.id);
    await request(app.getHttpServer())
      .get(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerB)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/owner/hotels')
      .set('Authorization', traveler)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/hotels/${hotel.id}`)
      .expect(403);
    const publicList = await request(app.getHttpServer())
      .get('/api/hotels')
      .expect(200);
    expect(
      (publicList.body as { id: string }[]).map((item) => item.id),
    ).not.toContain(hotel.id);
  });

  it('validates payloads, keeps owner/status server controlled, and protects other owners', async () => {
    const hotel = await create(ownerA, `own04_${Date.now()}_validation`);
    await request(app.getHttpServer())
      .post('/api/owner/hotels')
      .set('Authorization', ownerA)
      .send({
        clientDraftId: `own04_${Date.now()}_bad`,
        name: 'Test',
        accommodationType: 'CASTLE',
      })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerA)
      .send({ expectedVersion: 1, ownerId: 'other-owner' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerA)
      .send({ expectedVersion: 1, status: 'APPROVED' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerB)
      .send({ expectedVersion: 1, name: 'Không được đổi' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerB)
      .expect(403);
    expect(
      (await prisma.hotel.findUniqueOrThrow({ where: { id: hotel.id } }))
        .status,
    ).toBe('DRAFT');
  });

  it('saves contact, times and policy atomically and rejects stale concurrent writes', async () => {
    const hotel = await create(ownerA, `own04_${Date.now()}_edit`);
    const saved = await request(app.getHttpServer())
      .patch(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerA)
      .send({
        expectedVersion: 1,
        name: 'Resort đã sửa',
        contactEmail: 'contact@example.com',
        checkInTime: '14:00',
        checkOutTime: '12:00',
        policy: { cancellationPolicy: 'Hủy trước 48 giờ' },
      })
      .expect(200);
    const savedBody = saved.body as {
      profileVersion: number;
      policy: { cancellationPolicy: string };
      completion: { contact: boolean };
    };
    expect(savedBody.profileVersion).toBe(2);
    expect(savedBody.policy.cancellationPolicy).toBe('Hủy trước 48 giờ');
    expect(savedBody.completion.contact).toBe(true);
    await request(app.getHttpServer())
      .patch(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerA)
      .send({ expectedVersion: 1, name: 'Ghi đè lỗi' })
      .expect(409);
    const edits = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/owner/hotels/${hotel.id}`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: 2, description: 'Bản sửa A' }),
      request(app.getHttpServer())
        .patch(`/api/owner/hotels/${hotel.id}`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: 2, description: 'Bản sửa B' }),
    ]);
    expect(edits.map((item) => item.status).sort()).toEqual([200, 409]);
    expect(
      (await prisma.hotel.findUniqueOrThrow({ where: { id: hotel.id } }))
        .profileVersion,
    ).toBe(3);
  });

  it('denies editing pending, approved and suspended profiles through both APIs', async () => {
    const hotel = await create(ownerA, `own04_${Date.now()}_status`);
    for (const status of [
      HotelStatus.PENDING,
      HotelStatus.APPROVED,
      HotelStatus.SUSPENDED,
    ]) {
      await prisma.hotel.update({ where: { id: hotel.id }, data: { status } });
      await request(app.getHttpServer())
        .patch(`/api/owner/hotels/${hotel.id}`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: 1, name: 'Trạng thái lỗi' })
        .expect(409);
      await request(app.getHttpServer())
        .patch(`/api/hotels/${hotel.id}`)
        .set('Authorization', ownerA)
        .send({ name: 'Trạng thái lỗi' })
        .expect(409);
      await request(app.getHttpServer())
        .delete(`/api/owner/hotels/${hotel.id}`)
        .set('Authorization', ownerA)
        .expect(409);
    }
  });

  it('only soft-deletes an unbooked draft', async () => {
    const key = `own04_${Date.now()}_delete`;
    const hotel = await create(ownerA, key);
    await request(app.getHttpServer())
      .delete(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerA)
      .expect(204);
    expect(
      (await prisma.hotel.findUniqueOrThrow({ where: { id: hotel.id } }))
        .deletedAt,
    ).not.toBeNull();
    await request(app.getHttpServer())
      .get(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerA)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/owner/hotels')
      .set('Authorization', ownerA)
      .send({
        clientDraftId: key,
        name: 'Không được phục hồi',
        accommodationType: 'RESORT',
      })
      .expect(409);
  });

  it('keeps a draft with booking history and allows editing rejected profiles', async () => {
    const hotel = await create(ownerA, `own04_${Date.now()}_history`);
    const room = await prisma.room.create({
      data: {
        hotelId: hotel.id,
        name: 'Phòng kiểm thử',
        type: 'STANDARD',
        bedInfo: '1 giường đôi',
        basePrice: '100000',
      },
    });
    const travelerUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'traveler@bookingtravel.vn' },
      select: { id: true },
    });
    await prisma.booking.create({
      data: {
        code: `OWN04-${Date.now()}`,
        userId: travelerUser.id,
        hotelId: hotel.id,
        roomId: room.id,
        roomNameSnapshot: room.name,
        roomTypeSnapshot: room.type,
        checkIn: new Date('2027-01-01T00:00:00.000Z'),
        checkOut: new Date('2027-01-02T00:00:00.000Z'),
        adults: 1,
        nights: 1,
        pricePerNight: '100000',
        totalAmount: '100000',
        guestName: 'Khách kiểm thử',
        guestEmail: 'traveler@bookingtravel.vn',
      },
    });
    await request(app.getHttpServer())
      .delete(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerA)
      .expect(409);
    expect(
      (await prisma.hotel.findUniqueOrThrow({ where: { id: hotel.id } }))
        .deletedAt,
    ).toBeNull();
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { status: HotelStatus.REJECTED },
    });
    const edited = await request(app.getHttpServer())
      .patch(`/api/owner/hotels/${hotel.id}`)
      .set('Authorization', ownerA)
      .send({ expectedVersion: 1, accommodationType: 'VILLA' })
      .expect(200);
    const editedBody = edited.body as {
      accommodationType: string;
      status: string;
      bookingCount: number;
    };
    expect(editedBody.accommodationType).toBe('VILLA');
    expect(editedBody.status).toBe('REJECTED');
    expect(editedBody.bookingCount).toBe(1);
  });
});
