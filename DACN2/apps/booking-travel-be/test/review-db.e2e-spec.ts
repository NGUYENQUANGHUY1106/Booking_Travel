import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdtemp, readdir, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ReviewsModule } from '../src/modules/reviews/reviews.module';

const describeWithDatabase =
  process.env.RUN_DB_REV01_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-REV-01 HTTP and PostgreSQL', () => {
  let app: INestApplication<App>;
  let mediaDir: string;
  const previousMediaDir = process.env.LOCAL_MEDIA_DIR;

  beforeAll(async () => {
    mediaDir = await mkdtemp(join(tmpdir(), 'booking-review-media-'));
    process.env.LOCAL_MEDIA_DIR = mediaDir;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ ...configuration(), storage: {} })],
        }),
        DatabaseModule,
        AuthModule,
        ReviewsModule,
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
  });

  afterAll(async () => {
    await app?.close();
    if (previousMediaDir === undefined) delete process.env.LOCAL_MEDIA_DIR;
    else process.env.LOCAL_MEDIA_DIR = previousMediaDir;
    if (!mediaDir) return;
    const imagesDir = join(mediaDir, 'review-images');
    const files = await readdir(imagesDir).catch(() => []);
    for (const name of files) await unlink(join(imagesDir, name));
    if (files.length) await rmdir(imagesDir);
    await rmdir(mediaDir);
  });

  it('accepts just one concurrent review and publishes the verified stay and owner notification', async () => {
    const http = request(app.getHttpServer());
    const login = await http
      .post('/api/auth/login')
      .send({
        identifier: 'traveler@bookingtravel.vn',
        password: 'traveler123',
      })
      .expect(200);
    const { accessToken } = login.body as { accessToken: string };
    expect(accessToken).toEqual(expect.any(String));
    const auth = `Bearer ${accessToken}`;
    const body = {
      rating: 9,
      cleanliness: 8,
      location: 10,
      service: 9,
      facilities: 8,
      comfort: 9,
      value: 9,
      comment: 'Trải nghiệm tốt.',
    };
    const completed = '/api/reviews/bookings/seed-booking-completed';
    await http.post(completed).send(body).expect(401);
    await http
      .post('/api/reviews/bookings/seed-booking-confirmed')
      .set('Authorization', auth)
      .send(body)
      .expect(403);
    await http
      .post(completed)
      .set('Authorization', auth)
      .send({ ...body, rating: 11 })
      .expect(400);

    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT9sAAAAASUVORK5CYII=',
      'base64',
    );
    const reservation = await http
      .post(`${completed}/images/presign`)
      .set('Authorization', auth)
      .send({ extension: 'png', sizeBytes: image.length })
      .expect(201);
    const { uploadUrl, imageId } = reservation.body as {
      uploadUrl: string;
      imageId: string;
    };
    const imageUrl = uploadUrl.split('?')[0];
    await http
      .put(uploadUrl.replace(/s=[a-f0-9]+$/, 's=invalid'))
      .set('Content-Type', 'image/png')
      .send(image)
      .expect(403);
    await http
      .put(uploadUrl)
      .set('Content-Type', 'image/png')
      .send(image)
      .expect(204);
    await http.get(imageUrl).expect(404);
    const results = await Promise.all(
      [1, 2].map(() =>
        http
          .post(completed)
          .set('Authorization', auth)
          .send({ ...body, imageIds: [imageId] }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const db = app.get(PrismaService);
    const { hotelId } = await db.booking.findUniqueOrThrow({
      where: { id: 'seed-booking-completed' },
      select: { hotelId: true },
    });
    const published = await http
      .get(`/api/hotels/${hotelId}/reviews`)
      .expect(200);
    expect(published.body).toEqual([
      expect.objectContaining({
        rating: 9,
        verifiedStay: true,
        images: [imageUrl],
      }),
    ]);
    const download = await http
      .get(imageUrl)
      .expect('Content-Type', /image\/png/)
      .expect(200);
    expect(download.body).toEqual(image);
    expect((published.body as Record<string, unknown>[])[0]).not.toHaveProperty(
      'bookingId',
    );
    expect((published.body as Record<string, unknown>[])[0]).not.toHaveProperty(
      'userId',
    );
    const mine = await http
      .get('/api/reviews/me')
      .set('Authorization', auth)
      .expect(200);
    expect(mine.body).toHaveLength(1);
    await expect(
      db.hotel.findUnique({
        where: { id: hotelId },
        select: { reviewCount: true, reviewRatingSum: true },
      }),
    ).resolves.toEqual({ reviewCount: 1, reviewRatingSum: 9 });
    await expect(
      db.userNotification.count({
        where: { type: 'HOTEL_REVIEW_CREATED', userId: 'seed-user-owner' },
      }),
    ).resolves.toBe(1);
  });
});
