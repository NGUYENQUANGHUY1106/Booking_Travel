import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { AdminModule } from '../src/modules/admin/admin.module';

const describeWithDatabase =
  process.env.RUN_DB_ADM_E2E === '1' ? describe : describe.skip;

describeWithDatabase(
  'ST-ADM-02 seeded PostgreSQL transaction and session policy',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    let jwt: JwtService;
    let adminId: string;
    let targetId: string;
    let targetEmail: string;
    let adminSessionId: string;
    let targetSessionId: string;
    const password = 'TestPassword123!';

    const bearer = (id: string, sessionId: string) =>
      `Bearer ${jwt.sign({ sub: id, sessionId })}`;

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

      const suffix = randomUUID();
      targetEmail = `adm02-target-${suffix}@example.test`;
      const hashed = await hash(password, 12);
      const admin = await prisma.user.create({
        data: {
          email: `adm02-admin-${suffix}@example.test`,
          fullName: 'Admin kiểm thử',
          passwordHash: hashed,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          isActive: true,
          adminProfile: { create: { permissions: ['USER_MANAGEMENT'] } },
        },
      });
      const target = await prisma.user.create({
        data: {
          email: targetEmail,
          fullName: 'Người dùng kiểm thử',
          passwordHash: hashed,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          isActive: true,
        },
      });
      adminId = admin.id;
      targetId = target.id;
      adminSessionId = randomUUID();
      targetSessionId = randomUUID();
      await prisma.authSession.createMany({
        data: [
          {
            id: adminSessionId,
            userId: adminId,
            refreshTokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 3_600_000),
          },
          {
            id: targetSessionId,
            userId: targetId,
            refreshTokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 3_600_000),
          },
        ],
      });
    });

    afterAll(async () => {
      if (prisma && targetId && adminId) {
        await prisma.adminUserAudit.deleteMany({
          where: { targetUserId: targetId },
        });
        await prisma.authSession.deleteMany({
          where: { userId: { in: [targetId, adminId] } },
        });
        await prisma.adminProfile.deleteMany({ where: { userId: adminId } });
        await prisma.user.deleteMany({
          where: { id: { in: [targetId, adminId] } },
        });
      }
      await app?.close();
    });

    it('persists sanction + audit and invalidates old sessions even after restoration', async () => {
      const adminToken = bearer(adminId, adminSessionId);
      const oldTargetToken = bearer(targetId, targetSessionId);
      const list = await request(app.getHttpServer())
        .get('/api/admin/users')
        .query({ search: targetEmail, page: 1, limit: 10 })
        .set('Authorization', adminToken)
        .expect(200);
      const listBody = list.body as {
        total: number;
        items: Record<string, unknown>[];
      };
      expect(listBody.total).toBe(1);
      expect(listBody.items[0]).not.toHaveProperty('passwordHash');

      await request(app.getHttpServer())
        .patch(`/api/admin/users/${targetId}/suspend`)
        .set('Authorization', adminToken)
        .send({ reason: 'Kiểm tra chính sách' })
        .expect(200);
      const suspended = await prisma.user.findUniqueOrThrow({
        where: { id: targetId },
      });
      const oldSession = await prisma.authSession.findUniqueOrThrow({
        where: { id: targetSessionId },
      });
      const audit = await prisma.adminUserAudit.findFirstOrThrow({
        where: { targetUserId: targetId, action: 'SUSPEND' },
      });
      expect(suspended.status).toBe(UserStatus.SUSPENDED);
      expect(suspended.isActive).toBe(false);
      expect(oldSession.revokedAt).not.toBeNull();
      expect(audit).toMatchObject({
        actorId: adminId,
        oldStatus: UserStatus.ACTIVE,
        newStatus: UserStatus.SUSPENDED,
        reason: 'Kiểm tra chính sách',
      });
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', oldTargetToken)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: targetEmail, password })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/admin/users/${targetId}/restore`)
        .set('Authorization', adminToken)
        .send({ reason: 'Đã đối chiếu' })
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', oldTargetToken)
        .expect(401);
      const newLogin = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: targetEmail, password })
        .expect(200);
      const loginBody = newLogin.body as {
        user: { status: UserStatus };
        sessionId: string;
        accessToken: string;
      };
      expect(loginBody.user.status).toBe(UserStatus.ACTIVE);
      expect(loginBody.sessionId).not.toBe(targetSessionId);

      await request(app.getHttpServer())
        .patch(`/api/admin/users/${targetId}/lock`)
        .set('Authorization', adminToken)
        .send({ reason: 'Tạm khóa để rà soát' })
        .expect(200);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: targetId } }))
          .status,
      ).toBe(UserStatus.LOCKED);
      expect(
        (
          await prisma.authSession.findUniqueOrThrow({
            where: { id: loginBody.sessionId },
          })
        ).revokedAt,
      ).not.toBeNull();
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: targetEmail, password })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/admin/users/${targetId}/unlock`)
        .set('Authorization', adminToken)
        .send({ reason: 'Đã hoàn tất rà soát' })
        .expect(200);
      await request(app.getHttpServer())
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${loginBody.accessToken}`)
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: targetEmail, password })
        .expect(200);
      expect(
        await prisma.adminUserAudit.count({
          where: { targetUserId: targetId },
        }),
      ).toBe(4);
    });
  },
);
