import {
  ConflictException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  OwnerApplicationStatus,
  OwnerDocumentPurpose,
  PrivateMediaStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { PrivateMediaService } from '../src/infrastructure/storage/private-media.service';
import { StorageModule } from '../src/infrastructure/storage/storage.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { HotelOwnersModule } from '../src/modules/hotel-owners/hotel-owners.module';
import { HotelsModule } from '../src/modules/hotels/hotels.module';

const describeWithDatabase =
  process.env.RUN_DB_OWNER_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-ADM-03 owner verification API and PostgreSQL', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  const suffix = randomUUID();
  const users = Array.from({ length: 6 }, () => randomUUID());
  const sessions = Array.from({ length: 6 }, () => randomUUID());
  const applications = [randomUUID(), randomUUID()];
  const draftId = randomUUID();
  const documentIds = Array.from({ length: 4 }, () => randomUUID());
  const media = {
    assertReviewableDocuments: jest.fn().mockResolvedValue(undefined),
    adminReadUrl: jest.fn().mockResolvedValue({
      accessUrl: 'https://private.example.invalid/short-lived',
      expiresIn: 120,
      mimeType: 'application/pdf',
    }),
  };
  const token = (index: number) =>
    `Bearer ${jwt.sign({ sub: users[index], sessionId: sessions[index] })}`;
  const url = (index: number) =>
    `/api/admin/owner-applications/${applications[index]}`;

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
        AuthModule,
        StorageModule,
        HotelOwnersModule,
        HotelsModule,
      ],
    })
      .overrideProvider(PrivateMediaService)
      .useValue(media)
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
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);

    for (let i = 0; i < users.length; i++) {
      const role =
        i === 2 || i === 3 || i === 5
          ? UserRole.ADMIN
          : i === 4
            ? UserRole.HOTEL_OWNER
            : UserRole.USER;
      await prisma.user.create({
        data: {
          id: users[i],
          email: `st-adm-03-${i}-${suffix}@example.invalid`,
          passwordHash: i === 0 ? await hash('previewpass', 4) : 'unused',
          fullName: `Kiểm thử Owner ${i}`,
          role,
          status: UserStatus.ACTIVE,
          isActive: true,
          emailVerifiedAt: new Date(),
          ...(role === UserRole.ADMIN
            ? {
                adminProfile: {
                  create: { permissions: i === 5 ? [] : ['HOTEL_REVIEW'] },
                },
              }
            : {}),
        },
      });
      await prisma.authSession.create({
        data: {
          id: sessions[i],
          userId: users[i],
          refreshTokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 300_000),
        },
      });
    }
    for (let i = 0; i < 2; i++) {
      for (let purpose = 0; purpose < 2; purpose++) {
        const documentId = documentIds[i * 2 + purpose];
        await prisma.privateMediaObject.create({
          data: {
            id: documentId,
            userId: users[i],
            purpose:
              purpose === 0
                ? OwnerDocumentPurpose.IDENTITY
                : OwnerDocumentPurpose.BUSINESS_LICENSE,
            status: PrivateMediaStatus.READY,
            objectKey: `owner-verification/${users[i]}/${documentId}`,
            mimeType: 'application/pdf',
            expectedSize: 100,
            verifiedAt: new Date(),
          },
        });
      }
      await prisma.hotelOwnerApplication.create({
        data: {
          id: applications[i],
          userId: users[i],
          status: OwnerApplicationStatus.PENDING,
          businessName: `Cơ sở kiểm thử ${i}`,
          businessAddress: 'Hà Nội',
          identityDocumentId: documentIds[i * 2],
          businessLicenseDocumentId: documentIds[i * 2 + 1],
          submittedAt: new Date(),
        },
      });
    }
    await prisma.hotelOwnerApplication.create({
      data: { id: draftId, userId: users[4] },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.ownerApplicationNotification.deleteMany({
        where: { applicationId: { in: applications } },
      });
      await prisma.ownerApplicationAudit.deleteMany({
        where: { applicationId: { in: applications } },
      });
      await prisma.hotelOwnerProfile.deleteMany({
        where: { userId: { in: users } },
      });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    }
    if (app) await app.close();
  });

  it('enforces Admin role, permission, session and private document access', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/owner-applications')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/admin/owner-applications')
      .set('Authorization', token(0))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/owner-applications')
      .set('Authorization', token(4))
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/owner-applications')
      .set('Authorization', token(5))
      .expect(403);
    await request(app.getHttpServer())
      .get(`${url(0)}/documents/IDENTITY/access`)
      .set('Authorization', token(1))
      .expect(403);
    const access = await request(app.getHttpServer())
      .get(`${url(0)}/documents/IDENTITY/access`)
      .set('Authorization', token(2))
      .expect(200);
    expect(access.body).toEqual({
      accessUrl: 'https://private.example.invalid/short-lived',
      expiresIn: 120,
      mimeType: 'application/pdf',
    });
    await prisma.authSession.update({
      where: { id: sessions[5] },
      data: { revokedAt: new Date() },
    });
    await request(app.getHttpServer())
      .get('/api/admin/owner-applications')
      .set('Authorization', token(5))
      .expect(401);
  });

  it('searches, filters and paginates without exposing private object keys', async () => {
    const queue = await request(app.getHttpServer())
      .get('/api/admin/owner-applications?status=PENDING&page=1&limit=1')
      .set('Authorization', token(2))
      .expect(200);
    const queueBody = queue.body as {
      total: number;
      items: unknown[];
      summary: { pending: number };
    };
    expect(queueBody.total).toBeGreaterThanOrEqual(2);
    expect(queueBody.items).toHaveLength(1);
    expect(queueBody.summary.pending).toBeGreaterThanOrEqual(2);
    const filtered = await request(app.getHttpServer())
      .get(
        '/api/admin/owner-applications?search=C%C6%A1%20s%E1%BB%9F%20ki%E1%BB%83m%20th%E1%BB%AD%200',
      )
      .set('Authorization', token(2))
      .expect(200);
    expect((filtered.body as { items: unknown[] }).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: applications[0] }),
      ]),
    );
    const detail = await request(app.getHttpServer())
      .get(url(0))
      .set('Authorization', token(2))
      .expect(200);
    expect(
      (detail.body as { identityDocument: { id: string } }).identityDocument.id,
    ).toBe(documentIds[0]);
    expect(JSON.stringify(detail.body)).not.toContain('objectKey');
  });

  it('rejects invalid decisions and records rejection without granting role', async () => {
    await request(app.getHttpServer())
      .post(`/api/admin/owner-applications/${draftId}/decision`)
      .set('Authorization', token(2))
      .send({ decision: 'APPROVE', expectedVersion: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .post(`${url(1)}/decision`)
      .set('Authorization', token(1))
      .send({ decision: 'APPROVE', expectedVersion: 1 })
      .expect(403);
    await request(app.getHttpServer())
      .post(`${url(1)}/decision`)
      .set('Authorization', token(2))
      .send({ decision: 'REJECT', expectedVersion: 1, reason: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`${url(1)}/decision`)
      .set('Authorization', token(2))
      .send({
        decision: 'REJECT',
        expectedVersion: 1,
        reason: 'Thiếu thông tin',
        ownerRole: 'HOTEL_OWNER',
      })
      .expect(400);
    const decided = await request(app.getHttpServer())
      .post(`${url(1)}/decision`)
      .set('Authorization', token(2))
      .send({
        decision: 'REJECT',
        expectedVersion: 1,
        reason: 'Giấy tờ chưa rõ nét',
      })
      .expect(201);
    expect((decided.body as { status: string }).status).toBe('REJECTED');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: users[1] },
    });
    expect(user.role).toBe(UserRole.USER);
    expect(
      await prisma.hotelOwnerProfile.count({ where: { userId: users[1] } }),
    ).toBe(0);
    expect(
      await prisma.ownerApplicationAudit.count({
        where: {
          applicationId: applications[1],
          newStatus: OwnerApplicationStatus.REJECTED,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.ownerApplicationNotification.count({
        where: { applicationId: applications[1] },
      }),
    ).toBe(1);
    const self = await request(app.getHttpServer())
      .get('/api/owner-applications/me')
      .set('Authorization', token(1))
      .expect(200);
    expect(self.body).toMatchObject({ ownerEntitlementActive: false });
    expect(
      (self.body as { application: Record<string, unknown> }).application,
    ).not.toHaveProperty('reviewHistory');
    expect(
      (self.body as { application: Record<string, unknown> }).application,
    ).not.toHaveProperty('reviewedById');
    expect(
      (self.body as { application: Record<string, unknown> }).application,
    ).not.toHaveProperty('approvalNote');
    expect(
      (self.body as { application: { rejectionReason: string } }).application
        .rejectionReason,
    ).toBe('Giấy tờ chưa rõ nét');
    await request(app.getHttpServer())
      .post(`${url(1)}/decision`)
      .set('Authorization', token(2))
      .send({ decision: 'APPROVE', expectedVersion: 1 })
      .expect(409);
  });

  it('resubmits a rejected application and allows only one concurrent decision', async () => {
    const rejected = await prisma.hotelOwnerApplication.findUniqueOrThrow({
      where: { id: applications[1] },
    });
    await request(app.getHttpServer())
      .patch(`/api/owner-applications/${applications[1]}`)
      .set('Authorization', token(1))
      .send({
        businessName: 'Dữ liệu cũ',
        expectedRevision: rejected.revision - 1,
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/owner-applications/${applications[1]}/submit`)
      .set('Authorization', token(1))
      .send({
        expectedVersion: rejected.version + 1,
        expectedRevision: rejected.revision,
      })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/owner-applications/${applications[1]}/submit`)
      .set('Authorization', token(1))
      .send({
        expectedVersion: rejected.version,
        expectedRevision: rejected.revision,
      })
      .expect(201);
    const ready = await prisma.hotelOwnerApplication.findUniqueOrThrow({
      where: { id: applications[1] },
    });
    expect(ready.status).toBe(OwnerApplicationStatus.PENDING);
    expect(ready.version).toBe(2);
    await request(app.getHttpServer())
      .post(`${url(1)}/decision`)
      .set('Authorization', token(2))
      .send({ decision: 'APPROVE', expectedVersion: 1 })
      .expect(409);
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`${url(1)}/decision`)
        .set('Authorization', token(2))
        .send({ decision: 'APPROVE', expectedVersion: 2 }),
      request(app.getHttpServer())
        .post(`${url(1)}/decision`)
        .set('Authorization', token(3))
        .send({
          decision: 'REJECT',
          expectedVersion: 2,
          reason: 'Thông tin không khớp',
        }),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(
      await prisma.ownerApplicationAudit.count({
        where: { applicationId: applications[1], version: 2 },
      }),
    ).toBe(1);
    expect(
      await prisma.ownerApplicationNotification.count({
        where: { applicationId: applications[1], version: 2 },
      }),
    ).toBe(1);
  });

  it('approves only accessible documents, grants role once, and persists audit/notification', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        identifier: `st-adm-03-0-${suffix}@example.invalid`,
        password: 'previewpass',
      })
      .expect(200);
    const refreshToken = (login.body as { refreshToken: string }).refreshToken;
    media.assertReviewableDocuments.mockRejectedValueOnce(
      new ConflictException('R2 unavailable'),
    );
    await request(app.getHttpServer())
      .post(`${url(0)}/decision`)
      .set('Authorization', token(2))
      .send({ decision: 'APPROVE', expectedVersion: 1 })
      .expect(409);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).role,
    ).toBe(UserRole.USER);
    const approved = await request(app.getHttpServer())
      .post(`${url(0)}/decision`)
      .set('Authorization', token(2))
      .send({
        decision: 'APPROVE',
        expectedVersion: 1,
        reason: 'Đã đối chiếu giấy tờ',
      })
      .expect(201);
    expect((approved.body as { status: string }).status).toBe('VERIFIED');
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: users[0] } })).role,
    ).toBe(UserRole.HOTEL_OWNER);
    expect(
      await prisma.hotelOwnerProfile.count({
        where: { userId: users[0], isActive: true },
      }),
    ).toBe(1);
    expect(
      await prisma.ownerApplicationAudit.count({
        where: {
          applicationId: applications[0],
          newStatus: OwnerApplicationStatus.VERIFIED,
        },
      }),
    ).toBe(1);
    expect(
      await prisma.ownerApplicationNotification.count({
        where: { applicationId: applications[0] },
      }),
    ).toBe(1);
    await request(app.getHttpServer())
      .post(`${url(0)}/decision`)
      .set('Authorization', token(2))
      .send({ decision: 'APPROVE', expectedVersion: 1 })
      .expect(409);
    expect(
      await prisma.hotelOwnerProfile.count({ where: { userId: users[0] } }),
    ).toBe(1);
    await request(app.getHttpServer())
      .post(`${url(0)}/decision`)
      .set('Authorization', token(2))
      .send({
        decision: 'REJECT',
        expectedVersion: 1,
        reason: 'Quyết định không hợp lệ',
      })
      .expect(409);
    const self = await request(app.getHttpServer())
      .get('/api/owner-applications/me')
      .set('Authorization', token(0))
      .expect(200);
    expect(
      (self.body as { application: { status: string } }).application.status,
    ).toBe('VERIFIED');
    const refreshed = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(200);
    expect((refreshed.body as { user: { role: string } }).user.role).toBe(
      'HOTEL_OWNER',
    );
    const notifications = await request(app.getHttpServer())
      .get('/api/owner-applications/me/notifications')
      .set('Authorization', token(0))
      .expect(200);
    expect(notifications.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Hồ sơ Chủ khách sạn đã được xác minh',
        }),
      ]),
    );
  });

  it('blocks owner mutations and mode entitlement after suspension', async () => {
    const verified = await request(app.getHttpServer())
      .get('/api/owner-applications/me')
      .set('Authorization', token(0))
      .expect(200);
    expect(
      (verified.body as { ownerEntitlementActive: boolean })
        .ownerEntitlementActive,
    ).toBe(true);
    await prisma.hotelOwnerApplication.update({
      where: { id: applications[0] },
      data: { status: OwnerApplicationStatus.SUSPENDED },
    });
    await prisma.hotelOwnerProfile.update({
      where: { userId: users[0] },
      data: { isActive: false },
    });
    const suspended = await request(app.getHttpServer())
      .get('/api/owner-applications/me')
      .set('Authorization', token(0))
      .expect(200);
    expect(suspended.body).toMatchObject({
      application: { status: 'SUSPENDED' },
      ownerEntitlementActive: false,
    });
    await request(app.getHttpServer())
      .post('/api/hotels')
      .set('Authorization', token(0))
      .send({
        name: 'Hotel test',
        slug: 'hotel-test',
        addressLine: '123 Main',
        city: 'Hà Nội',
        province: 'Hà Nội',
      })
      .expect(403);
  });
});
