import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { ReviewSummaryProvider } from '../src/modules/ai/review-summary.provider';

const live = process.env.RUN_GEMINI_REVIEW_E2E === '1';

(live ? describe : describe.skip)(
  'ST-AI-06 HTTP, PostgreSQL and Gemini',
  () => {
    let app: INestApplication<App>;
    let prisma: PrismaService;
    const testId = 'ai-review-' + randomUUID();

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api');
      await app.init();
      prisma = app.get(PrismaService);
      expect(app.get(ReviewSummaryProvider).configured()).toBe(true);
    });

    afterAll(async () => {
      try {
        if (!prisma) return;
        await prisma.$transaction([
          prisma.review.deleteMany({ where: { userId: testId } }),
          prisma.booking.deleteMany({ where: { userId: testId } }),
          prisma.hotel.deleteMany({ where: { ownerId: testId } }),
          prisma.user.deleteMany({ where: { id: testId } }),
        ]);
      } finally {
        await app?.close();
      }
    });

    it('groups reviews, stores the result, discards stale results and restricts hotel visibility', async () => {
      await prisma.user.create({
        data: {
          id: testId,
          fullName: 'Synthetic fixture',
          passwordHash: 'unused',
        },
      });
      const hotel = await prisma.hotel.create({
        data: {
          name: 'Synthetic hotel',
          slug: testId,
          ownerId: testId,
          status: 'APPROVED',
        },
      });
      const room = await prisma.room.create({
        data: {
          name: 'Test room',
          type: 'Test',
          basePrice: 100_000,
          bedInfo: '1 bed',
          hotelId: hotel.id,
        },
      });
      const endpoint = '/api/ai/hotels/' + hotel.id + '/review-summary';
      const http = request(app.getHttpServer());
      await http
        .get(endpoint)
        .expect(200)
        .expect({
          status: 'INSUFFICIENT',
          stats: { count: 0, average: null, sampleCount: 0 },
        });
      const comments = [
        'Phòng rất sạch, nhân viên thân thiện! 😍',
        'The room was dirty and the staff were rude.',
        'Khách sạn cách ga khoảng 200 mét.',
        'Nội dung đã ẩn trong kiểm thử',
        'Nội dung đã xóa trong kiểm thử',
        '   ',
      ];
      for (const [index, comment] of comments.entries()) {
        await prisma.booking.create({
          data: {
            code: testId + '-' + index,
            hotelId: hotel.id,
            roomId: room.id,
            userId: testId,
            hotelNameSnapshot: hotel.name,
            hotelAddressSnapshot: 'Test',
            roomNameSnapshot: room.name,
            roomTypeSnapshot: room.type,
            adults: 1,
            nights: 1,
            pricePerNight: 100_000,
            totalAmount: 100_000,
            checkIn: new Date('2025-02-01'),
            checkOut: new Date('2025-02-02'),
            status: 'COMPLETED',
            guestName: 'Synthetic guest',
            guestEmail: 'test@example.com',
            review: {
              create: {
                hotelId: hotel.id,
                userId: testId,
                comment,
                rating: 8,
                cleanliness: 8,
                location: 8,
                service: 8,
                facilities: 8,
                comfort: 8,
                value: 8,
                hiddenAt: index === 3 ? new Date() : undefined,
                deletedAt: index === 4 ? new Date() : undefined,
              },
            },
          },
        });
      }
      await prisma.hotel.update({
        where: { id: hotel.id },
        data: { reviewCount: 4, reviewRatingSum: 32 },
      });
      const first = await http.get(endpoint).expect(200);
      expect(first.body).toMatchObject({
        status: 'READY',
        stats: { count: 4, average: 8, sampleCount: 3 },
        summary: {
          sentiment: [
            { label: 'POSITIVE', count: 1, percent: 33.3 },
            { label: 'NEUTRAL', count: 1, percent: 33.3 },
            { label: 'NEGATIVE', count: 1, percent: 33.3 },
          ],
        },
      });
      const saved = await prisma.aIReviewSummary.findUniqueOrThrow({
        where: { hotelId: hotel.id },
      });
      expect(first.body).toMatchObject({
        version: saved.corpusVersion,
        generatedAt: saved.generatedAt.toISOString(),
      });
      const cached = await http.get(endpoint).expect(200);
      expect(cached.body).toEqual(first.body);

      await prisma.review.updateMany({
        where: { hotelId: hotel.id, comment: comments[0] },
        data: { hiddenAt: new Date() },
      });
      await prisma.hotel.update({
        where: { id: hotel.id },
        data: { reviewCount: 3, reviewRatingSum: 24 },
      });
      await http
        .get(endpoint)
        .expect(200)
        .expect({
          status: 'INSUFFICIENT',
          stats: { count: 3, average: 8, sampleCount: 2 },
        });
      await prisma.hotel.update({
        where: { id: hotel.id },
        data: { isVisible: false },
      });
      await http.get(endpoint).expect(404);
      await http
        .get(endpoint)
        .set('Authorization', 'Bearer invalid')
        .expect(401);
    }, 30_000);
  },
);
