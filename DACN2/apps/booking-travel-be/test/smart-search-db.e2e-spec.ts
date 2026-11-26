import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AiModule } from '../src/modules/ai/ai.module';

const describeWithDatabase =
  process.env.RUN_DB_AI02_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-AI-02 Smart Search HTTP / PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const ownerId = randomUUID();
  const hotelId = randomUUID();
  const roomId = randomUUID();
  const destination = `AI02 Đà Nẵng ${hotelId.slice(0, 8)}`;

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
        AiModule,
      ],
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
    await prisma.user.create({
      data: {
        id: ownerId,
        email: `${ownerId}@example.invalid`,
        fullName: 'AI02 QA Owner',
        passwordHash: 'unused',
        role: 'HOTEL_OWNER',
        status: 'ACTIVE',
        isActive: true,
      },
    });
    await prisma.hotel.create({
      data: {
        id: hotelId,
        ownerId,
        name: 'AI02 Blue Hotel',
        slug: hotelId,
        addressLine: 'Bãi biển Mỹ Khê',
        city: destination,
        province: 'Đà Nẵng',
        description: 'Khách sạn 4 sao gần biển Mỹ Khê.',
        accommodationType: 'HOTEL',
        starRating: 4,
        status: 'APPROVED',
        isVisible: true,
      },
    });
    await prisma.room.create({
      data: {
        id: roomId,
        hotelId,
        name: 'AI02 Deluxe',
        type: 'DELUXE',
        bedInfo: 'Double',
        quantity: 2,
        basePrice: 1_500_000,
        capacityAdults: 2,
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.room.deleteMany({ where: { id: roomId } });
      await prisma.hotel.deleteMany({ where: { id: hotelId } });
      await prisma.user.deleteMany({ where: { id: ownerId } });
    }
    await app?.close();
  });

  it('returns only grounded database hotels for a supported query', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ai/smart-search')
      .send({
        query: 'Khách sạn 4 sao gần biển dưới 2 triệu',
        destination,
      })
      .expect(201);
    const body = response.body as {
      status: string;
      intent: Record<string, unknown>;
      items: { id: string }[];
    };

    expect(body.status).toBe('RESULTS');
    expect(body.intent).toMatchObject({
      confidence: 0.9,
      destination,
      stars: [4],
      maxPrice: 2_000_000,
      features: ['NEAR_BEACH'],
    });
    expect(body.items.map((hotel) => hotel.id)).toEqual([hotelId]);
  });

  it('rejects an unrelated sentence without returning database hotels', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ai/smart-search')
      .send({
        query: 'Hãy giải giúp tôi bài toán lượng giác này',
        destination,
      })
      .expect(201);
    const body = response.body as Record<string, unknown>;

    expect(body).toMatchObject({
      status: 'UNSUPPORTED_QUERY',
      message:
        'Tôi được cấu hình để tìm kiếm những khách sạn phù hợp cho bạn. Nội dung này nằm ngoài hiểu biết của tôi. Xin cảm ơn.',
      items: [],
      pagination: { total: 0 },
    });
  });
});
