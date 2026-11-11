import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AccessTokenGuard } from '../src/common/guards/access-token.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AdminHotelManagementController } from '../src/modules/hotels/admin-hotel-management.controller';
import { AdminHotelManagementService } from '../src/modules/hotels/admin-hotel-management.service';

describe('ST-ADM-05 Admin hotel API authorization', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const list = jest.fn(() =>
    Promise.resolve({ items: [], total: 0, page: 1, limit: 10 }),
  );
  const detail = jest.fn(() => Promise.resolve({ id: 'hotel-a' }));
  const decide = jest.fn(() =>
    Promise.resolve({ hotelId: 'hotel-a', status: 'SUSPENDED' }),
  );
  const users = {
    admin: {
      id: 'admin',
      role: UserRole.ADMIN,
      adminProfile: { permissions: ['HOTEL_REVIEW'] },
    },
    limitedAdmin: {
      id: 'limitedAdmin',
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
      controllers: [AdminHotelManagementController],
      providers: [
        AccessTokenGuard,
        RolesGuard,
        {
          provide: AdminHotelManagementService,
          useValue: { list, detail, decide },
        },
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
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows only Admin with HOTEL_REVIEW to read and decide', async () => {
    await request(app.getHttpServer()).get('/api/admin/hotels').expect(401);
    for (const id of ['owner', 'traveler', 'limitedAdmin'] as const) {
      await request(app.getHttpServer())
        .get('/api/admin/hotels')
        .set('Authorization', bearer(id))
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/admin/hotels/hotel-a/decision')
        .set('Authorization', bearer(id))
        .send({
          action: 'SUSPEND',
          reason: 'Vi phạm quy định',
          expectedRestrictionVersion: 0,
          expectedProfileVersion: 1,
          requestId: 'adm05-test-auth',
        })
        .expect(403);
    }
    await request(app.getHttpServer())
      .get('/api/admin/hotels')
      .set('Authorization', bearer('admin'))
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/admin/hotels/hotel-a')
      .set('Authorization', bearer('admin'))
      .expect(200);
    expect(list).toHaveBeenCalledTimes(1);
    expect(detail).toHaveBeenCalledTimes(1);
    expect(decide).not.toHaveBeenCalled();
  });

  it('rejects invalid reason, version and extra body fields before service mutation', async () => {
    const url = '/api/admin/hotels/hotel-a/decision';
    const auth = bearer('admin');
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', auth)
      .send({
        action: 'HIDE',
        reason: '   ',
        expectedRestrictionVersion: 0,
        expectedProfileVersion: 1,
        requestId: 'adm05-test-invalid',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', auth)
      .send({
        action: 'HIDE',
        reason: 'Vi phạm quy định',
        expectedRestrictionVersion: -1,
        expectedProfileVersion: 1,
        requestId: 'adm05-test-invalid',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post(url)
      .set('Authorization', auth)
      .send({
        action: 'HIDE',
        reason: 'Vi phạm quy định',
        expectedRestrictionVersion: 0,
        expectedProfileVersion: 1,
        requestId: 'adm05-test-invalid',
        isVisible: true,
      })
      .expect(400);
    expect(decide).not.toHaveBeenCalled();
  });
});
