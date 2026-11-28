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
import { ChatModule } from '../src/modules/chat/chat.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ReviewsModule } from '../src/modules/reviews/reviews.module';
import { ReportsModule } from '../src/modules/reports/reports.module';

const describeWithDatabase =
  process.env.RUN_DB_REV01_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-REV-01 / ST-REV-02 HTTP and PostgreSQL', () => {
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
        ChatModule,
        ReviewsModule,
        ReportsModule,
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

  it('creates one verified review, permits only its author to edit/delete, and keeps the hotel aggregate correct', async () => {
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

    const [{ id: reviewId }] = mine.body as Array<{ id: string }>;
    const ownPath = `/api/reviews/me/${reviewId}`;
    const edited = { ...body, rating: 6, comment: 'Tôi đã cập nhật nhận xét.' };
    const owner = await http
      .post('/api/auth/login')
      .send({ identifier: 'owner@bookingtravel.vn', password: 'owner123' })
      .expect(200);
    const other = `Bearer ${(owner.body as { accessToken: string }).accessToken}`;
    const guestPath = `/api/owner/guests/${hotelId}/seed-user-traveler`;
    await http.get(guestPath).set('Authorization', auth).expect(403);
    const guest = await http
      .get(guestPath)
      .set('Authorization', other)
      .expect(200);
    expect(guest.body).toMatchObject({
      relation: 'BOOKING',
      user: { id: 'seed-user-traveler' },
    });
    const conversation = await http
      .post(guestPath + '/conversation')
      .set('Authorization', other)
      .expect(201);
    const repeatConversation = await http
      .post(guestPath + '/conversation')
      .set('Authorization', other)
      .expect(201);
    expect(repeatConversation.body).toEqual(conversation.body);
    const reportPath = '/api/content-reports';
    const queuePath = '/api/admin/content-reports';
    const reportInput = {
      targetType: 'REVIEW',
      targetId: reviewId,
      reason: 'MISLEADING',
      description: 'Cần kiểm tra nội dung.',
    };
    await http.post(reportPath).send(reportInput).expect(401);
    await http.get(queuePath).set('Authorization', other).expect(403);
    await http
      .post(reportPath)
      .set('Authorization', auth)
      .send(reportInput)
      .expect(400);
    await http
      .post(reportPath)
      .set('Authorization', other)
      .send({ ...reportInput, targetType: 'PUBLIC_CHAT' })
      .expect(400);
    const reports = await Promise.all(
      [1, 2].map(() =>
        http.post(reportPath).set('Authorization', other).send(reportInput),
      ),
    );
    expect(reports.map(({ status }) => status).sort()).toEqual([201, 409]);
    const admin = await http
      .post('/api/auth/login')
      .send({ identifier: 'admin@bookingtravel.vn', password: 'admin123' })
      .expect(200);
    const adminAuth = `Bearer ${(admin.body as { accessToken: string }).accessToken}`;
    const adminReviews = '/api/admin/reviews';
    const directModeration = `${adminReviews}/${reviewId}/moderation`;
    const hide = { action: 'HIDE', reason: 'Kiểm tra quyền kiểm duyệt.' };
    await http.get(adminReviews).set('Authorization', other).expect(403);
    await http
      .patch(directModeration)
      .set('Authorization', auth)
      .send(hide)
      .expect(403);
    const adminList = await http
      .get(adminReviews)
      .set('Authorization', adminAuth)
      .expect(200);
    expect(adminList.body).toContainEqual(
      expect.objectContaining({ id: reviewId, isVisible: true }),
    );
    await http
      .patch(directModeration)
      .set('Authorization', adminAuth)
      .send(hide)
      .expect(200);
    await http.get(`/api/hotels/${hotelId}/reviews`).expect(200).expect([]);
    await expect(
      db.hotel.findUnique({
        where: { id: hotelId },
        select: { reviewCount: true, reviewRatingSum: true },
      }),
    ).resolves.toEqual({ reviewCount: 0, reviewRatingSum: 0 });
    await http
      .patch(directModeration)
      .set('Authorization', adminAuth)
      .send({ action: 'RESTORE', reason: 'Đã xác minh nội dung.' })
      .expect(200);
    await expect(
      db.reportModerationAction.count({
        where: { targetId: reviewId, reportId: '' },
      }),
    ).resolves.toBe(2);
    const queue = await http
      .get(queuePath)
      .set('Authorization', adminAuth)
      .expect(200);
    expect(queue.body).toMatchObject({
      items: [
        {
          reviewId,
          reporterId: 'seed-user-owner',
          reason: 'MISLEADING',
          description: reportInput.description,
          snapshot: body.comment,
          status: 'OPEN',
        },
      ],
    });
    expect(
      (await http.get(`/api/hotels/${hotelId}/reviews`).expect(200)).body,
    ).toHaveLength(1);
    const replyPath = `/api/reviews/${reviewId}/reply`;
    const reply = await http
      .post(replyPath)
      .set('Authorization', other)
      .send({ content: 'Cảm ơn bạn đã lưu trú.' })
      .expect(201);
    await http
      .get('/api/reviews/owner')
      .set('Authorization', other)
      .expect(200)
      .expect(({ body }) => {
        const items = body as {
          id: string;
          reply: { content: string } | null;
        }[];
        expect(items.find((item) => item.id === reviewId)?.reply?.content).toBe(
          'Cảm ơn bạn đã lưu trú.',
        );
      });
    await http
      .patch(replyPath)
      .set('Authorization', other)
      .send({ content: 'Cảm ơn bạn đã góp ý.', version: 1 })
      .expect(200);
    await http
      .get(`/api/hotels/${hotelId}/reviews`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            reply: { content: 'Cảm ơn bạn đã góp ý.' },
          }),
        ]);
      });
    const replyReport = await http
      .post(`${replyPath}/report`)
      .set('Authorization', auth)
      .send({ reason: 'Kiểm tra phản hồi.', category: 'OTHER' })
      .expect(201);
    const reportId = (
      reports.find(({ status }) => status === 201)!.body as { id: string }
    ).id;
    const moderation = '/api/admin/hotel-reports';
    await http
      .get(`${moderation}/queue`)
      .set('Authorization', adminAuth)
      .query({ targetType: 'REVIEW' })
      .expect(200)
      .expect(({ body }) => {
        expect(
          (body as { items: { id: string }[] }).items.find(
            (item) => item.id === reportId,
          ),
        ).toMatchObject({ status: 'OPEN' });
      });
    const reviewDecision = `${moderation}/queue/REVIEW/${reportId}`;
    await http
      .post(`${reviewDecision}/claim`)
      .set('Authorization', adminAuth)
      .expect(201);
    await http
      .post(`${reviewDecision}/decision`)
      .set('Authorization', adminAuth)
      .send({
        action: 'HIDE',
        reason: 'Nội dung đánh giá cần được ẩn.',
        requestId: 'review-db-hide',
      })
      .expect(201);
    await http.get(`/api/hotels/${hotelId}/reviews`).expect(200).expect([]);
    await http
      .patch(ownPath)
      .set('Authorization', auth)
      .send(edited)
      .expect(409);
    await http
      .post(`${moderation}/restore/REVIEW/${reviewId}`)
      .set('Authorization', adminAuth)
      .send({
        reason: 'Đã xác minh lại nội dung.',
        requestId: 'review-db-restore',
      })
      .expect(201);
    const replyDecision = `${moderation}/queue/REPLY/${(replyReport.body as { id: string }).id}`;
    await http
      .post(`${replyDecision}/claim`)
      .set('Authorization', adminAuth)
      .expect(201);
    await http
      .post(`${replyDecision}/decision`)
      .set('Authorization', adminAuth)
      .send({
        action: 'HIDE',
        reason: 'Nội dung phản hồi cần được ẩn.',
        requestId: 'reply-db-hide',
      })
      .expect(201);
    await http
      .get(`/api/hotels/${hotelId}/reviews`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([expect.objectContaining({ reply: null })]);
      });
    expect((reply.body as { id: string }).id).toBeTruthy();
    await http.get(ownPath).set('Authorization', other).expect(404);
    await http
      .patch(ownPath)
      .set('Authorization', other)
      .send(edited)
      .expect(404);
    await http.delete(ownPath).set('Authorization', other).expect(404);
    await http
      .patch(ownPath)
      .set('Authorization', auth)
      .send({ ...edited, rating: 11 })
      .expect(400);
    await db.review.update({
      where: { id: reviewId },
      data: { moderationLockedAt: new Date() },
    });
    await http
      .patch(ownPath)
      .set('Authorization', auth)
      .send(edited)
      .expect(409);
    await http.delete(ownPath).set('Authorization', auth).expect(409);
    await db.review.update({
      where: { id: reviewId },
      data: { moderationLockedAt: null },
    });
    const updated = await http
      .patch(ownPath)
      .set('Authorization', auth)
      .send(edited)
      .expect(200);
    expect(updated.body).toMatchObject({
      rating: 6,
      comment: edited.comment,
      images: [imageUrl],
    });
    const publicAfterEdit = await http
      .get(`/api/hotels/${hotelId}/reviews`)
      .expect(200);
    expect(publicAfterEdit.body).toEqual([
      expect.objectContaining({ rating: 6, comment: edited.comment }),
    ]);
    await expect(
      db.hotel.findUnique({
        where: { id: hotelId },
        select: { reviewCount: true, reviewRatingSum: true },
      }),
    ).resolves.toEqual({ reviewCount: 1, reviewRatingSum: 6 });

    const deletes = await Promise.all(
      [1, 2].map(() => http.delete(ownPath).set('Authorization', auth)),
    );
    expect(deletes.map((result) => result.status).sort()).toEqual([204, 404]);
    const deleted = await db.review.findUniqueOrThrow({
      where: { id: reviewId },
    });
    const removedReport = await http
      .post(reportPath)
      .set('Authorization', other)
      .send(reportInput)
      .expect(201);
    expect(removedReport.body).toEqual({ status: 'ALREADY_HANDLED' });
    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(deleted.updatedAt.getTime()).toBeGreaterThanOrEqual(
      deleted.createdAt.getTime(),
    );
    expect(
      (await http.get('/api/reviews/me').set('Authorization', auth).expect(200))
        .body,
    ).toEqual([]);
    expect(
      (await http.get(`/api/hotels/${hotelId}/reviews`).expect(200)).body,
    ).toEqual([]);
    expect(
      (await http.get(completed).set('Authorization', auth).expect(200)).body,
    ).toMatchObject({ review: null, reviewDeleted: true });
    await http.get(imageUrl).expect(404);
    await http
      .post(completed)
      .set('Authorization', auth)
      .send(body)
      .expect(409);
    await expect(
      db.hotel.findUnique({
        where: { id: hotelId },
        select: { reviewCount: true, reviewRatingSum: true },
      }),
    ).resolves.toEqual({ reviewCount: 0, reviewRatingSum: 0 });
  });
});
