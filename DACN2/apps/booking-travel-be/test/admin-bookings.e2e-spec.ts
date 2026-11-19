import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AccessTokenGuard } from '../src/common/guards/access-token.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AdminBookingsController } from '../src/modules/bookings/admin-bookings.controller';
import { AdminBookingsService } from '../src/modules/bookings/admin-bookings.service';

describe('ST-ADM-06 Admin booking API', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const list = jest.fn(() =>
    Promise.resolve({ items: [], total: 0, page: 1, limit: 20 }),
  );
  const detail = jest.fn((_: unknown, id: string) =>
    id === 'missing'
      ? Promise.reject(new NotFoundException('Không tìm thấy đặt phòng.'))
      : Promise.resolve({ booking: { id } }),
  );
  const users = {
    admin: {
      id: 'admin',
      role: UserRole.ADMIN,
      adminProfile: { permissions: ['BOOKING_SUPPORT'] },
    },
    limited: {
      id: 'limited',
      role: UserRole.ADMIN,
      adminProfile: { permissions: [] },
    },
    owner: { id: 'owner', role: UserRole.HOTEL_OWNER, adminProfile: null },
    traveler: { id: 'traveler', role: UserRole.USER, adminProfile: null },
  };
  const bearer = (id: keyof typeof users) =>
    `Bearer ${jwt.sign({ sub: id, sessionId: `session-${id}` })}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [AdminBookingsController],
      providers: [
        AccessTokenGuard,
        RolesGuard,
        { provide: AdminBookingsService, useValue: { list, detail } },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(
                ({ where }: { where: { id: keyof typeof users } }) =>
                  Promise.resolve(
                    users[where.id]
                      ? {
                          ...users[where.id],
                          status: UserStatus.ACTIVE,
                          isActive: true,
                        }
                      : null,
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
          },
        },
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
    jwt = app.get(JwtService);
  });

  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => jest.clearAllMocks());

  it('blocks anonymous, User, Owner and Admin without BOOKING_SUPPORT', async () => {
    await request(app.getHttpServer()).get('/api/admin/bookings').expect(401);
    for (const user of ['traveler', 'owner', 'limited'] as const) {
      await request(app.getHttpServer())
        .get('/api/admin/bookings')
        .set('Authorization', bearer(user))
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/admin/bookings/guessed-id')
        .set('Authorization', bearer(user))
        .expect(403);
    }
    expect(list).not.toHaveBeenCalled();
    expect(detail).not.toHaveBeenCalled();
  });

  it('accepts valid Admin filters, rejects invalid input and returns 404', async () => {
    await request(app.getHttpServer())
      .get(
        '/api/admin/bookings?page=2&limit=10&status=CONFIRMED&dateField=checkIn&from=2026-12-01',
      )
      .set('Authorization', bearer('admin'))
      .expect(200);
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'admin' }),
      expect.objectContaining({
        page: 2,
        limit: 10,
        status: 'CONFIRMED',
        dateField: 'checkIn',
      }),
    );
    await request(app.getHttpServer())
      .get('/api/admin/bookings?status=INVALID')
      .set('Authorization', bearer('admin'))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/admin/bookings/missing')
      .set('Authorization', bearer('admin'))
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/admin/bookings/booking-a')
      .set('Authorization', bearer('admin'))
      .expect(200);
    await request(app.getHttpServer())
      .patch('/api/admin/bookings/booking-a')
      .set('Authorization', bearer('admin'))
      .send({ status: 'COMPLETED' })
      .expect(404);
  });
});
