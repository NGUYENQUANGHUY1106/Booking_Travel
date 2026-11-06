import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  AccommodationPreferenceType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
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
  let localCoverId: string | undefined;

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
    if (localCoverId) {
      const path = resolve(
        process.env.LOCAL_MEDIA_DIR ?? '../../.local-media',
        'owner-covers',
        localCoverId,
      );
      await unlink(path).catch(() => undefined);
      await unlink(`${path}.json`).catch(() => undefined);
    }
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
      .patch(`/api/owner-applications/${applicationId}`)
      .set('Authorization', token(0))
      .send({ hotelCoverImageUrl: 'https://evil.example/cover.jpg' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/owner-applications/${applicationId}/cover-upload`)
      .set('Authorization', token(1))
      .send({ contentType: 'image/jpeg', sizeBytes: 1024 })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/owner-applications/${applicationId}/submit`)
      .set('Authorization', token(0))
      .expect(400);
  });

  it('uploads a local cover image and saves it to the owner application', async () => {
    if (process.env.R2_PUBLIC_BUCKET) return;
    const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const reservation = await request(app.getHttpServer())
      .post(`/api/owner-applications/${applicationId}/cover-upload`)
      .set('Authorization', token(0))
      .send({ contentType: 'image/png', sizeBytes: image.length })
      .expect(201);
    const urls = reservation.body as { uploadUrl: string; publicUrl: string };
    localCoverId = /owner-covers\/([^/]+)\/content/.exec(urls.publicUrl)?.[1];
    expect(localCoverId).toBeTruthy();
    await request(app.getHttpServer())
      .put(urls.uploadUrl)
      .set('Content-Type', 'image/png')
      .send(image)
      .expect(204);
    await request(app.getHttpServer()).get(urls.publicUrl).expect(200);
    const absoluteUrl = new URL(
      urls.publicUrl,
      process.env.EXPO_PUBLIC_API_BASE_URL,
    ).toString();
    const updated = await request(app.getHttpServer())
      .patch(`/api/owner-applications/${applicationId}`)
      .set('Authorization', token(0))
      .send({ hotelCoverImageUrl: absoluteUrl })
      .expect(200);
    expect(
      (updated.body as { hotelCoverImageUrl: string }).hotelCoverImageUrl,
    ).toBe(absoluteUrl);
  });

  it('submits hotel details without private documents', async () => {
    await request(app.getHttpServer())
      .patch(`/api/owner-applications/${applicationId}`)
      .set('Authorization', token(0))
      .send({
        businessName: 'Cơ sở A',
        businessAddress: 'Hà Nội',
        businessPhone: '0901234567',
        accommodationType: AccommodationPreferenceType.HOTEL,
        hotelDescription: 'Khách sạn kiểm thử',
      })
      .expect(200);
    if (process.env.R2_PUBLIC_BUCKET)
      await prisma.hotelOwnerApplication.update({
        where: { id: applicationId },
        data: { hotelCoverImageUrl: 'https://example.com/cover.jpg' },
      });
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
