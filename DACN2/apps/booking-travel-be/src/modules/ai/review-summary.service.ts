import { Injectable, NotFoundException } from '@nestjs/common';
import {
  HotelStatus,
  Prisma,
  UserRole,
  type AIReviewSummary,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  ReviewSummaryProvider,
  SENTIMENTS,
  TOPICS,
  type ReviewLabel,
} from './review-summary.provider';

const MIN_REVIEWS = 3;
const SAMPLE_SIZE = 16;
const TOPIC_LABELS = {
  ROOM: 'Phòng',
  CLEANLINESS: 'Vệ sinh',
  SERVICE: 'Phục vụ',
  LOCATION: 'Vị trí',
  FACILITIES: 'Tiện nghi',
  VALUE: 'Giá trị so với giá',
} as const;

export function prepareReviewText(comment: string) {
  return comment
    .replace(/https?:\/\/\S+|www\.\S+/gi, '[link]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\s().-]*){8,}\d/g, '[contact]')
    .trim()
    .slice(0, 700);
}

function summarize(reviews: ReviewLabel[]) {
  const sentiment = SENTIMENTS.map((label) => {
    const count = reviews.filter((review) => review.sentiment === label).length;
    return {
      label,
      count,
      percent: Math.round((count / reviews.length) * 1000) / 10,
    };
  });
  const topics = TOPICS.flatMap((topic) => {
    const mentions = reviews
      .flatMap((review) => review.topics)
      .filter((item) => item.topic === topic);
    if (!mentions.length) return [];
    return [
      {
        topic,
        label: TOPIC_LABELS[topic],
        count: mentions.length,
        positive: mentions.filter((item) => item.sentiment === 'POSITIVE')
          .length,
        negative: mentions.filter((item) => item.sentiment === 'NEGATIVE')
          .length,
      },
    ];
  }).sort((a, b) => b.count - a.count);
  return { sentiment, topics };
}

@Injectable()
export class ReviewSummaryService {
  private running?: {
    version: string;
    result: Promise<AIReviewSummary | null>;
  };
  private retryAfter = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ReviewSummaryProvider,
  ) {}

  private async source(hotelId: string, user?: AuthenticatedUser) {
    const visible = { isVisible: true, status: HotelStatus.APPROVED };
    const scope: Prisma.HotelWhereInput =
      user?.role === UserRole.ADMIN && user.permissions.includes('HOTEL_REVIEW')
        ? {}
        : user?.role === UserRole.HOTEL_OWNER && !user.ownerAccessBlocked
          ? { OR: [visible, { ownerId: user.id }] }
          : visible;
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null, ...scope },
      select: {
        reviewCount: true,
        reviewRatingSum: true,
        reviews: {
          where: { hiddenAt: null, deletedAt: null, comment: { not: '' } },
          select: { id: true, comment: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: SAMPLE_SIZE,
        },
      },
    });
    if (!hotel)
      throw new NotFoundException(
        'Không tìm thấy khách sạn trong phạm vi truy cập.',
      );
    const corpus = hotel.reviews
      .map(({ id, comment }) => ({ id, text: prepareReviewText(comment) }))
      .filter(({ text }) => text);
    const version = createHash('sha256')
      .update(JSON.stringify([1, hotelId, this.provider.model, corpus]))
      .digest('hex');
    return {
      version,
      corpus,
      stats: {
        count: hotel.reviewCount,
        average: hotel.reviewCount
          ? Math.round((hotel.reviewRatingSum / hotel.reviewCount) * 10) / 10
          : null,
        sampleCount: corpus.length,
      },
    };
  }

  async get(hotelId: string, user?: AuthenticatedUser) {
    const source = await this.source(hotelId, user);
    if (source.corpus.length < MIN_REVIEWS)
      return { status: 'INSUFFICIENT', stats: source.stats };
    const cached = await this.prisma.aIReviewSummary.findUnique({
      where: { hotelId },
    });
    if (cached?.corpusVersion === source.version)
      return {
        status: 'READY',
        stats: source.stats,
        summary: cached.result,
        generatedAt: cached.generatedAt,
        version: source.version,
        model: cached.model,
      };
    if (
      !this.provider.configured() ||
      Date.now() < this.retryAfter ||
      (this.running && this.running.version !== source.version)
    )
      return { status: 'UNAVAILABLE', stats: source.stats };

    if (!this.running) {
      const result = this.provider
        .classify(source.corpus.map(({ text }) => text))
        .catch(() => {
          this.retryAfter = Date.now() + 30_000;
          return null;
        })
        .then(async (labels) => {
          if (
            !labels ||
            (await this.source(hotelId, user)).version !== source.version
          )
            return null;
          const result = summarize(labels);
          const model = this.provider.model;
          return this.prisma.aIReviewSummary.upsert({
            where: { hotelId },
            create: { hotelId, corpusVersion: source.version, model, result },
            update: {
              corpusVersion: source.version,
              model,
              result,
              generatedAt: new Date(),
            },
          });
        })
        .finally(() => {
          this.running = undefined;
        });
      this.running = { version: source.version, result };
    }

    const saved = await this.running.result;
    const latest = await this.source(hotelId, user);
    if (!saved || saved.corpusVersion !== latest.version)
      return { status: 'UNAVAILABLE', stats: latest.stats };
    return {
      status: 'READY',
      stats: latest.stats,
      summary: saved.result,
      generatedAt: saved.generatedAt,
      version: latest.version,
      model: saved.model,
    };
  }
}
