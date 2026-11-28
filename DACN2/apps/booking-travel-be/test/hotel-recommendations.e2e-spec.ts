import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';

const db =
  process.env.RUN_DB_RECOMMENDATIONS_E2E === '1' ? describe : describe.skip;

type Results = {
  mode: 'PERSONALIZED' | 'DISCOVERY';
  items: {
    hotel: { id: string; stayNights?: number; stayPriceFrom?: string };
    reasons: string[];
  }[];
};

db('ST-AI-03 recommendations with PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const destination = 'Recommendation ' + randomUUID();
  const password = 'recommendations-test-password';
  const userIds = ['budget', 'premium', 'new'].map(
    (name) => name + '-' + randomUUID(),
  );

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
  });

  afterAll(async () => {
    try {
      if (!prisma) return;
      await prisma.roomInventoryBlock.deleteMany({
        where: { actorId: userIds[0] },
      });
      await prisma.hotel.deleteMany({ where: { city: destination } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await app?.close();
    }
  });

  it('ranks by preferences and scores, filters available rooms, and keeps profiles isolated', async () => {
    const passwordHash = await hash(password, 4);
    await prisma.user.createMany({
      data: userIds.map((id) => ({
        id,
        email: id + '@example.com',
        fullName: 'Test traveler',
        passwordHash,
        emailVerifiedAt: new Date(),
        isActive: true,
        status: 'ACTIVE',
      })),
    });
    await prisma.userPreference.createMany({
      data: [
        {
          userId: userIds[0],
          budgetMax: 600000,
          accommodationTypes: ['HOMESTAY'],
        },
        {
          userId: userIds[1],
          budgetMin: 2000000,
          accommodationTypes: ['RESORT'],
        },
      ],
    });

    const hotel = (
      name: string,
      price: number,
      accommodationType: 'HOMESTAY' | 'RESORT',
      rating: number,
      isVisible = true,
      quantity = 3,
    ) =>
      prisma.hotel.create({
        data: {
          name,
          city: destination,
          slug: userIds[0] + '-' + name,
          ownerId: userIds[0],
          status: 'APPROVED',
          isVisible,
          accommodationType,
          reviewCount: 10,
          reviewRatingSum: rating * 10,
          rooms: {
            create: {
              name: 'Test room',
              type: 'DEFAULT',
              bedInfo: 'One',
              quantity,
              basePrice: price,
            },
          },
        },
      });
    const [budget, premium] = await Promise.all([
      hotel('Budget', 500000, 'HOMESTAY', 7, true, 1),
      hotel('Premium', 2500000, 'RESORT', 9),
      hotel('Hidden', 2500000, 'RESORT', 10, false),
    ]);
    const http = request(app.getHttpServer());
    const path = '/api/ai/hotel-recommendations';
    async function login(id: string) {
      const response = await http
        .post('/api/auth/login')
        .send({ identifier: id + '@example.com', password })
        .expect(200);
      return 'Bearer ' + (response.body as { accessToken: string }).accessToken;
    }
    const budgetAuth = await login(userIds[0]);
    const premiumAuth = await login(userIds[1]);
    const newAuth = await login(userIds[2]);

    const forGuest = await http
      .get(path)
      .query({ search: destination })
      .expect(200);
    expect(forGuest.headers['cache-control']).toBe('private, no-store');
    const fallback = forGuest.body as Results;
    expect(fallback.mode).toBe('DISCOVERY');
    expect(fallback.items.map(({ hotel }) => hotel.id)).toEqual([
      premium.id,
      budget.id,
    ]);
    const newAccount = await http
      .get(path)
      .query({ search: destination })
      .set('Authorization', newAuth)
      .expect(200);
    expect(newAccount.body).toEqual(fallback);

    const forBudget = await http
      .get(path)
      .query({ search: destination })
      .set('Authorization', budgetAuth)
      .expect(200);
    const economical = forBudget.body as Results;
    expect(economical.mode).toBe('PERSONALIZED');
    expect(economical.items[0].hotel.id).toBe(budget.id);
    expect(economical.items[0].reasons).toContain(
      'Đúng loại chỗ ở bạn đã chọn',
    );
    expect(economical.items[0].hotel).not.toHaveProperty('owner');

    const forPremium = await http
      .get(path)
      .query({ search: destination, limit: 1 })
      .set('Authorization', premiumAuth)
      .expect(200);
    const luxury = forPremium.body as Results;
    expect(luxury.mode).toBe('PERSONALIZED');
    expect(luxury.items.map(({ hotel }) => hotel.id)).toEqual([premium.id]);

    const arrivals = new Date(Date.now() + 60 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const departure = new Date(Date.now() + 62 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const available = await http
      .get(path)
      .query({
        search: destination,
        checkIn: arrivals,
        checkOut: departure,
        rooms: 2,
      })
      .set('Authorization', budgetAuth)
      .expect(200);
    expect(available.body).toMatchObject({
      items: [
        { hotel: { id: premium.id, stayNights: 2, stayPriceFrom: '10000000' } },
      ],
    });

    const premiumRoom = await prisma.room.findFirstOrThrow({
      where: { hotelId: premium.id },
    });
    await prisma.roomInventoryBlock.create({
      data: {
        roomId: premiumRoom.id,
        hotelId: premium.id,
        actorId: userIds[0],
        startDate: new Date(arrivals),
        endDateExclusive: new Date(departure),
        quantity: 2,
        reason: 'Test room block',
        idempotencyKey: userIds[0],
      },
    });
    await http
      .get(path)
      .query({
        search: destination,
        checkIn: arrivals,
        checkOut: departure,
        rooms: 2,
      })
      .expect(200, { mode: 'DISCOVERY', items: [] });

    await http
      .get(path)
      .query({ search: 'Does not exist ' + randomUUID() })
      .expect(200, { mode: 'DISCOVERY', items: [] });
    await http.get(path).query({ checkIn: arrivals }).expect(400);
    await http.get(path).query({ limit: 13 }).expect(400);
    await http
      .get(path)
      .query({ userId: userIds[1] })
      .set('Authorization', budgetAuth)
      .expect(400);
    await http.get(path).set('Authorization', 'Bearer invalid').expect(401);
    await http
      .get(path)
      .set('Authorization', premiumAuth)
      .set('X-Recommendation-Account', userIds[0])
      .expect(403);
  }, 30_000);
});
