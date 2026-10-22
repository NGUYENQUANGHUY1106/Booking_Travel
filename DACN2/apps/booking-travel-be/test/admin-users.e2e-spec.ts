import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { AdminModule } from '../src/modules/admin/admin.module';

describe('ST-ADM-02 API authorization and account actions', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let targetStatus: UserStatus;
  let revoked: boolean;
  const auditCreate = jest.fn();
  const users = {
    'admin-actor': {
      id: 'admin-actor',
      role: UserRole.ADMIN,
      adminProfile: { permissions: ['USER_MANAGEMENT'] },
    },
    'target-user-1': {
      id: 'target-user-1',
      role: UserRole.USER,
      adminProfile: null,
    },
    'owner-user-1': {
      id: 'owner-user-1',
      role: UserRole.HOTEL_OWNER,
      adminProfile: null,
    },
  };
  const userFindUnique = jest.fn(
    ({ where }: { where: { id: keyof typeof users } }) => {
      const user = users[where.id];
      if (!user) return Promise.resolve(null);
      const status =
        user.id === 'target-user-1' ? targetStatus : UserStatus.ACTIVE;
      return Promise.resolve({
        ...user,
        status,
        isActive: status === UserStatus.ACTIVE,
      });
    },
  );
  const database = {
    user: {
      findUnique: userFindUnique,
      count: jest.fn(() => Promise.resolve(1)),
      findMany: jest.fn(() =>
        Promise.resolve([
          {
            id: 'target-user-1',
            fullName: 'Người dùng',
            role: UserRole.USER,
            status: targetStatus,
            authSessions: [],
          },
        ]),
      ),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { status: UserStatus };
          data: { status: UserStatus };
        }) => {
          if (where.status !== targetStatus)
            return Promise.resolve({ count: 0 });
          targetStatus = data.status;
          return Promise.resolve({ count: 1 });
        },
      ),
    },
    authSession: {
      findFirst: jest.fn(({ where }: { where: { userId: string } }) =>
        Promise.resolve({
          revokedAt:
            where.userId === 'target-user-1' && revoked ? new Date() : null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ),
      updateMany: jest.fn(() => {
        revoked = true;
        return Promise.resolve({ count: 1 });
      }),
    },
    adminUserAudit: { create: auditCreate },
    adminProfile: { findMany: jest.fn(() => Promise.resolve([])) },
  };
  const prisma = {
    ...database,
    $transaction: jest.fn(
      (
        operation: ((client: typeof database) => unknown) | Promise<unknown>[],
      ) =>
        typeof operation === 'function'
          ? Promise.resolve(operation(database))
          : Promise.all(operation),
    ),
  };
  const bearer = (id: keyof typeof users) =>
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
        AdminModule,
      ],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
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
  beforeEach(() => {
    jest.clearAllMocks();
    targetStatus = UserStatus.ACTIVE;
    revoked = false;
    auditCreate.mockResolvedValue({ id: 'audit-1', createdAt: new Date() });
  });

  it('requires a valid ADMIN session with USER_MANAGEMENT permission', async () => {
    await request(app.getHttpServer()).get('/api/admin/users').expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', 'Bearer invalid')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', bearer('target-user-1'))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', bearer('owner-user-1'))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', bearer('admin-actor'))
      .expect(200);
  });

  it('rejects invalid query and extra mutation fields', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/users?page=0')
      .set('Authorization', bearer('admin-actor'))
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/admin/users/target-user-1/suspend')
      .set('Authorization', bearer('admin-actor'))
      .send({ reason: 'Vi phạm', role: 'ADMIN' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/admin/users/target-user-1/suspend')
      .set('Authorization', bearer('admin-actor'))
      .send({ reason: '   ' })
      .expect(400);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('revokes sessions on suspend and rejects replayed action and protected access', async () => {
    await request(app.getHttpServer())
      .patch('/api/admin/users/target-user-1/suspend')
      .set('Authorization', bearer('admin-actor'))
      .send({ reason: 'Vi phạm chính sách' })
      .expect(200);
    expect(targetStatus).toBe(UserStatus.SUSPENDED);
    expect(revoked).toBe(true);
    expect(auditCreate).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer())
      .patch('/api/admin/users/target-user-1/suspend')
      .set('Authorization', bearer('admin-actor'))
      .send({ reason: 'Lặp lại' })
      .expect(409);
    await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', bearer('target-user-1'))
      .expect(401);
  });
});
