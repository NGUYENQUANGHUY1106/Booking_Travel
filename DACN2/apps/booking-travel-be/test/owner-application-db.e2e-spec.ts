import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  OwnerDocumentPurpose,
  PrivateMediaStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { StorageModule } from '../src/infrastructure/storage/storage.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { HotelOwnersModule } from '../src/modules/hotel-owners/hotel-owners.module';
import { MediaModule } from '../src/modules/media/media.module';

const describeWithDatabase =
  process.env.RUN_DB_OWNER_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-OWN-01 PostgreSQL and API', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  const suffix = randomUUID();
  const userIds = [randomUUID(), randomUUID(), randomUUID()];
  const sessionIds = [randomUUID(), randomUUID(), randomUUID()];
  let applicationId: string;

  const token = (index: number) =>
    `Bearer ${jwt.sign({ sub: userIds[index], sessionId: sessionIds[index] })}`;

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
        MediaModule,
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

    for (let i = 0; i < userIds.length; i++) {
      await prisma.user.create({
        data: {
          id: userIds[i],
          email: `st-own-01-${i}-${suffix}@example.invalid`,
          passwordHash: 'unused',
          fullName: `Owner test ${i}`,
          role: i === 2 ? UserRole.ADMIN : UserRole.USER,
          status: UserStatus.ACTIVE,
          isActive: true,
          emailVerifiedAt: new Date(),
          ...(i === 2
            ? { adminProfile: { create: { permissions: ['HOTEL_REVIEW'] } } }
            : {}),
        },
      });
      await prisma.authSession.create({
        data: {
          id: sessionIds[i],
          userId: userIds[i],
          refreshTokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
  });

  afterAll(async () => {
    if (prisma)
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (app) await app.close();
  });

  it('requires authentication and creates only one draft', async () => {
    await request(app.getHttpServer())
      .get('/api/owner-applications/me')
      .expect(401);
    const created = await request(app.getHttpServer())
      .post('/api/owner-applications')
      .set('Authorization', token(0))
      .expect(201);
    const createdBody = created.body as { id: string; status: string };
    applicationId = createdBody.id;
    expect(createdBody.status).toBe('DRAFT');
    const repeated = await request(app.getHttpServer())
      .post('/api/owner-applications')
      .set('Authorization', token(0))
      .expect(201);
    expect((repeated.body as { id: string }).id).toBe(applicationId);
  });

  it('rejects cross-user updates, role forgery and premature submission', async () => {
    await request(app.getHttpServer())
      .patch(`/api/owner-applications/${applicationId}`)
      .set('Authorization', token(1))
      .send({ businessName: 'Sai' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/owner-applications/${applicationId}`)
      .set('Authorization', token(0))
      .send({ role: 'HOTEL_OWNER' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/owner-applications/${applicationId}/submit`)
      .set('Authorization', token(0))
      .expect(400);
  });

  it('requires private finalized documents before marking pending', async () => {
    const documentIds = [randomUUID(), randomUUID()];
    for (let i = 0; i < documentIds.length; i++) {
      await prisma.privateMediaObject.create({
        data: {
          id: documentIds[i],
          userId: userIds[0],
          purpose:
            i === 0
              ? OwnerDocumentPurpose.IDENTITY
              : OwnerDocumentPurpose.BUSINESS_LICENSE,
          status: PrivateMediaStatus.READY,
          objectKey: `owner-verification/${userIds[0]}/${documentIds[i]}`,
          mimeType: 'application/pdf',
          expectedSize: 100,
          verifiedAt: new Date(),
        },
      });
    }
    await request(app.getHttpServer())
      .patch(`/api/owner-applications/${applicationId}`)
      .set('Authorization', token(0))
      .send({
        businessName: 'Cơ sở A',
        businessAddress: 'Hà Nội',
        identityDocumentId: documentIds[0],
        businessLicenseDocumentId: documentIds[1],
      })
      .expect(200);
    const submitted = await request(app.getHttpServer())
      .post(`/api/owner-applications/${applicationId}/submit`)
      .set('Authorization', token(0))
      .expect(201);
    expect((submitted.body as { status: string }).status).toBe('PENDING');
    const duplicate = await request(app.getHttpServer())
      .post(`/api/owner-applications/${applicationId}/submit`)
      .set('Authorization', token(0))
      .expect(201);
    expect((duplicate.body as { id: string }).id).toBe(applicationId);
    const applicant = await prisma.user.findUniqueOrThrow({
      where: { id: userIds[0] },
    });
    expect(applicant.role).toBe(UserRole.USER);
    await request(app.getHttpServer())
      .post('/api/owner-applications')
      .set('Authorization', token(0))
      .expect(409);
  });

  it('makes pending application visible only to an authorized admin', async () => {
    await request(app.getHttpServer())
      .get('/api/admin/owner-applications')
      .set('Authorization', token(1))
      .expect(403);
    const queue = await request(app.getHttpServer())
      .get('/api/admin/owner-applications')
      .set('Authorization', token(2))
      .expect(200);
    expect((queue.body as { items: unknown[] }).items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: applicationId })]),
    );
  });
});
