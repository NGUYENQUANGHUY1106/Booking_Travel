import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { PlatformVouchersService } from '../src/modules/promotions/platform-vouchers.service';
import { OwnerPromotionsService } from '../src/modules/promotions/owner-promotions.service';
import { PromotionsModule } from '../src/modules/promotions/promotions.module';

describe('ST-ADM-09 voucher API authorization', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const vouchers = {
    list: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
    create: jest.fn().mockResolvedValue({ id: 'voucher-1' }),
    get: jest.fn().mockResolvedValue({ id: 'voucher-1' }),
    redemptions: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    update: jest.fn().mockResolvedValue({ id: 'voucher-1', version: 2 }),
    action: jest.fn().mockResolvedValue({ id: 'voucher-1', status: 'ACTIVE' }),
  };
  const ownerPromotions = {
    adminList: jest.fn().mockResolvedValue({
      items: [{ id: 'owner-promo-1', code: 'OWNER10' }],
      total: 1,
      page: 1,
      limit: 20,
    }),
    adminGet: jest
      .fn()
      .mockResolvedValue({ id: 'owner-promo-1', code: 'OWNER10' }),
  };
  const prisma = {
    user: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          role: where.id === 'owner' ? UserRole.HOTEL_OWNER : UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          isActive: true,
          adminProfile: {
            permissions: where.id === 'admin' ? ['PROMOTION_MANAGEMENT'] : [],
          },
          ownerApplication: null,
          ownerProfile: null,
        }),
      ),
    },
    authSession: {
      findFirst: jest.fn().mockResolvedValue({
        revokedAt: null,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      }),
    },
  };

  const bearer = (id: string) =>
    `Bearer ${jwt.sign({ sub: id, sessionId: `session-${id}` })}`;

  beforeAll(async () => {
    process.env.SKIP_DATABASE_CONNECT = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ auth: { accessSecret: 'test-access-secret' } })],
        }),
        DatabaseModule,
        PromotionsModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PlatformVouchersService)
      .useValue(vouchers)
      .overrideProvider(OwnerPromotionsService)
      .useValue(ownerPromotions)
      .compile();
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
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => jest.clearAllMocks());

  it('denies anonymous, owner and admin without the promotion permission', async () => {
    await request(app.getHttpServer()).get('/api/admin/campaigns').expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/campaigns')
      .set('Authorization', bearer('owner'))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/campaigns')
      .set('Authorization', bearer('other-admin'))
      .expect(403);
    expect(vouchers.list).not.toHaveBeenCalled();
  });

  it('exposes Owner promotions to a permitted Admin as read-only data', async () => {
    const path = '/api/admin/owner-promotions';
    await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', bearer('owner'))
      .expect(403);
    await request(app.getHttpServer())
      .get(path)
      .set('Authorization', bearer('other-admin'))
      .expect(403);
    const list = await request(app.getHttpServer())
      .get(path)
      .set('Authorization', bearer('admin'))
      .expect(200);
    expect((list.body as { items: { code: string }[] }).items[0]?.code).toBe(
      'OWNER10',
    );
    await request(app.getHttpServer())
      .get(`${path}/owner-promo-1`)
      .set('Authorization', bearer('admin'))
      .expect(200);
    await request(app.getHttpServer())
      .post(path)
      .set('Authorization', bearer('admin'))
      .send({ code: 'NOPE' })
      .expect(404);
    expect(ownerPromotions.adminList).toHaveBeenCalledTimes(1);
    expect(ownerPromotions.adminGet).toHaveBeenCalledWith('owner-promo-1');
  });

  it('allows a permitted admin and binds the actor to mutations', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/campaigns')
      .set('Authorization', bearer('admin'))
      .expect(200);
    const data = {
      code: ' TEST10 ',
      title: 'Giảm 10%',
      discountType: 'PERCENT',
      discountValue: '10',
      maxDiscount: '100000',
      minSpend: '100000',
      budget: '1000000',
      currency: 'VND',
      startsAt: '2026-11-20T00:00:00.000Z',
      endsAt: '2026-12-20T00:00:00.000Z',
      minNights: 1,
      globalLimit: 10,
      perUserLimit: 1,
    };
    await request(app.getHttpServer())
      .post('/api/admin/campaigns')
      .set('Authorization', bearer('admin'))
      .send(data)
      .expect(201);
    expect(vouchers.create).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TEST10' }),
      expect.objectContaining({ id: 'admin', role: UserRole.ADMIN }),
    );
    await request(app.getHttpServer())
      .post('/api/admin/campaigns/voucher-1/activate')
      .set('Authorization', bearer('admin'))
      .send({ version: 1, reason: 'Đã kiểm tra chương trình' })
      .expect(201);
    expect(vouchers.action).toHaveBeenCalledWith(
      'voucher-1',
      'activate',
      expect.objectContaining({ version: 1 }),
      expect.objectContaining({ id: 'admin' }),
    );
  });

  it('rejects invalid voucher input before the service runs', async () => {
    await request(app.getHttpServer())
      .post('/api/admin/campaigns')
      .set('Authorization', bearer('admin'))
      .send({ code: 'bad' })
      .expect(400);
    expect(vouchers.create).not.toHaveBeenCalled();
  });
});
