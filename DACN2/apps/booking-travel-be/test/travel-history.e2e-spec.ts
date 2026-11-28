import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

const withDatabase =
  process.env.RUN_DB_HISTORY_E2E === '1' ? describe : describe.skip;

withDatabase('ST-USR-04 HTTP and PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const userA = 'history-a-' + randomUUID();
  const userB = 'history-b-' + randomUUID();
  const route = '/api/users/me/travel-history';
  const password = 'history-test-password';
  const criteria = {
    destination: 'Đà Nẵng',
    checkIn: '2090-11-30',
    checkOut: '2090-12-02',
    adults: 2,
    children: 1,
    rooms: 2,
    minPrice: 100000,
    maxPrice: 2000000,
    stars: [3, 4],
    minReviewScore: 8,
    propertyTypes: ['HOTEL'],
    amenities: ['Wi-Fi miễn phí'],
    freeCancellation: true,
    sort: 'priceAsc',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
    const passwordHash = await hash(password, 4);
    await prisma.user.createMany({
      data: [userA, userB].map((id) => ({
        id,
        email: id + '@example.com',
        fullName: 'Test traveler',
        passwordHash,
        emailVerifiedAt: new Date(),
        isActive: true,
        status: 'ACTIVE',
      })),
    });
  });

  afterAll(async () => {
    try {
      if (!prisma) return;
      await prisma.$transaction([
        prisma.hotelViewHistory.deleteMany({
          where: { userId: { in: [userA, userB] } },
        }),
        prisma.hotel.deleteMany({ where: { ownerId: userA } }),
        prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } }),
      ]);
    } finally {
      await app?.close();
    }
  });

  it('persists opt-in per account, deduplicates, hides inactive hotels and allows scoped deletion', async () => {
    const http = request(app.getHttpServer());
    async function login(id: string) {
      const result = await http
        .post('/api/auth/login')
        .send({ identifier: id + '@example.com', password })
        .expect(200);
      return 'Bearer ' + (result.body as { accessToken: string }).accessToken;
    }
    const a = await login(userA);
    const b = await login(userB);
    const get = (auth: string) => http.get(route).set('Authorization', auth);
    await http.get(route).expect(401);
    await get(a)
      .expect(200)
      .expect({ enabled: false, searches: [], hotels: [] });
    await http
      .post(route + '/searches')
      .set('Authorization', a)
      .send(criteria)
      .expect(201)
      .expect({ recorded: false });
    await http
      .put(route + '/consent')
      .set('Authorization', a)
      .send({ enabled: true })
      .expect(200);
    await http
      .post(route + '/searches')
      .set('Authorization', a)
      .send({ ...criteria, userId: userB })
      .expect(400);
    await http
      .post(route + '/searches')
      .set('Authorization', a)
      .send({ ...criteria, checkOut: criteria.checkIn })
      .expect(400);
    for (const stars of [
      [3, 4],
      [4, 3],
    ]) {
      await http
        .post(route + '/searches')
        .set('Authorization', a)
        .send({ ...criteria, stars })
        .expect(201)
        .expect({ recorded: true });
    }
    const hotel = await prisma.hotel.create({
      data: {
        ownerId: userA,
        name: 'Test Sea Hotel',
        slug: userA,
        status: 'APPROVED',
      },
    });
    await Promise.all(
      [0, 1].map(() =>
        http
          .post(route + '/hotels')
          .set('Authorization', a)
          .send({ hotelId: hotel.id })
          .expect(201)
          .expect({ recorded: true }),
      ),
    );
    const afterRelogin = await get(await login(userA)).expect(200);
    const saved = afterRelogin.body as {
      searches: { id: string; criteria: object }[];
      hotels: { hotelId: string; viewCount: number }[];
    };
    expect(saved.searches).toHaveLength(1);
    expect(saved.searches[0].criteria).toEqual(criteria);
    expect(saved.hotels).toMatchObject([
      { hotelId: hotel.id, hotelName: hotel.name, viewCount: 2 },
    ]);
    await http
      .put(route + '/consent')
      .set('Authorization', b)
      .send({ enabled: true })
      .expect(200);
    await get(b).set('X-Travel-History-Account', userA).expect(403);
    await http
      .delete(route + '/searches/' + saved.searches[0].id)
      .set('Authorization', b)
      .expect(200)
      .expect({ removed: 0 });
    await http
      .delete(route + '/hotels/' + hotel.id)
      .set('Authorization', b)
      .expect(200)
      .expect({ removed: 0 });
    await get(b)
      .expect(200)
      .expect({ enabled: true, searches: [], hotels: [] });
    await prisma.hotel.update({
      where: { id: hotel.id },
      data: { status: 'SUSPENDED' },
    });
    await http
      .post(route + '/hotels')
      .set('Authorization', a)
      .send({ hotelId: hotel.id })
      .expect(201)
      .expect({ recorded: false });
    expect((await get(a).expect(200)).body).toMatchObject({ hotels: [] });
    await http
      .delete(route + '/searches/' + saved.searches[0].id)
      .set('Authorization', a)
      .expect(200)
      .expect({ removed: 1 });
    await http
      .delete(route)
      .set('Authorization', a)
      .expect(200)
      .expect({ cleared: true });
    await get(a)
      .expect(200)
      .expect({ enabled: true, searches: [], hotels: [] });
    await http
      .post(route + '/searches')
      .set('Authorization', a)
      .send(criteria)
      .expect(201);
    await http
      .put(route + '/consent')
      .set('Authorization', a)
      .send({ enabled: false })
      .expect(200);
    await get(a)
      .expect(200)
      .expect({ enabled: false, searches: [], hotels: [] });
    expect(
      await prisma.hotelSearchHistory.count({ where: { userId: userA } }),
    ).toBe(0);
  }, 30_000);
});
