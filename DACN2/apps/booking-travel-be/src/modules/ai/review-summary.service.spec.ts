import { HotelStatus, UserRole } from '@prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ReviewSummaryProvider } from './review-summary.provider';
import {
  prepareReviewText,
  ReviewSummaryService,
} from './review-summary.service';

describe('ReviewSummaryService', () => {
  const classify = jest.fn();
  const findFirst = jest.fn<Promise<unknown>, [unknown]>();
  const findUnique = jest.fn();
  const upsert = jest.fn();
  let service: ReviewSummaryService;
  const comments = ['Phòng rất sạch', 'Wi-Fi was slow', 'Địa chỉ gần ga'];
  const hotel = {
    reviewCount: 3,
    reviewRatingSum: 24,
    reviews: comments.map((comment, index) => ({
      id: 'review-' + index,
      comment,
    })),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    findFirst.mockResolvedValue(hotel);
    findUnique.mockResolvedValue(null);
    classify.mockResolvedValue([
      {
        index: 0,
        sentiment: 'POSITIVE',
        topics: [{ topic: 'ROOM', sentiment: 'POSITIVE' }],
      },
      {
        index: 1,
        sentiment: 'NEGATIVE',
        topics: [{ topic: 'FACILITIES', sentiment: 'NEGATIVE' }],
      },
      { index: 2, sentiment: 'NEUTRAL', topics: [] },
    ]);
    service = new ReviewSummaryService(
      {
        hotel: { findFirst },
        aIReviewSummary: { findUnique, upsert },
      } as unknown as PrismaService,
      {
        classify,
        model: 'gemini-test',
        configured: () => true,
      } as unknown as ReviewSummaryProvider,
    );
  });

  it('filters hidden and deleted reviews and returns raw scores for insufficient text', async () => {
    findFirst.mockResolvedValue({
      ...hotel,
      reviews: [{ id: 'blank', comment: '  ' }],
    });
    await expect(service.get('hotel')).resolves.toEqual({
      status: 'INSUFFICIENT',
      stats: { count: 3, average: 8, sampleCount: 0 },
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'hotel',
          deletedAt: null,
          isVisible: true,
          status: HotelStatus.APPROVED,
        },
        select: expect.objectContaining({
          reviews: expect.objectContaining({
            where: { hiddenAt: null, deletedAt: null, comment: { not: '' } },
            take: 16,
          }) as unknown,
        }) as unknown,
      }),
    );
    expect(classify).not.toHaveBeenCalled();
  });

  it('limits private hotel access to the active owner and review moderators', async () => {
    findFirst.mockResolvedValue(null);
    const actor = { id: 'owner', sessionId: 'session', permissions: [] };
    await expect(
      service.get('private', {
        ...actor,
        role: UserRole.HOTEL_OWNER,
        ownerAccessBlocked: true,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(findFirst.mock.calls[0][0]).toMatchObject({
      where: { isVisible: true, status: HotelStatus.APPROVED },
    });
    await expect(
      service.get('private', {
        ...actor,
        role: UserRole.HOTEL_OWNER,
        ownerAccessBlocked: false,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(findFirst.mock.calls[1][0]).toMatchObject({
      where: {
        OR: [
          { isVisible: true, status: HotelStatus.APPROVED },
          { ownerId: actor.id },
        ],
      },
    });
    await expect(
      service.get('private', {
        ...actor,
        role: UserRole.ADMIN,
        permissions: ['HOTEL_REVIEW'],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(findFirst.mock.calls[2][0]).toMatchObject({
      where: { id: 'private', deletedAt: null },
    });
  });

  it('strips common contact details from the review body', () => {
    expect(
      prepareReviewText(
        'Great stay 👍 https://example.com me@example.com 0912 345 678',
      ),
    ).toBe('Great stay 👍 [link] [email] [contact]');
  });

  it('shares one request and persists a versioned result for unchanged reviews', async () => {
    const savedAt = new Date();
    upsert.mockImplementation(({ create }: { create: object }) =>
      Promise.resolve({ ...create, generatedAt: savedAt }),
    );
    const [first, second] = await Promise.all([
      service.get('hotel'),
      service.get('hotel'),
    ]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      status: 'READY',
      generatedAt: savedAt,
      summary: {
        sentiment: [
          { label: 'POSITIVE', percent: 33.3, count: 1 },
          { label: 'NEUTRAL', percent: 33.3, count: 1 },
          { label: 'NEGATIVE', percent: 33.3, count: 1 },
        ],
      },
    });
    expect(classify).toHaveBeenCalledTimes(1);
    expect(classify).toHaveBeenCalledWith(comments);
    expect(upsert).toHaveBeenCalledTimes(1);
    findUnique.mockResolvedValue({
      corpusVersion: first.version,
      result: first.summary,
      generatedAt: savedAt,
      model: 'gemini-test',
    });
    await expect(service.get('hotel')).resolves.toEqual(first);
    expect(classify).toHaveBeenCalledTimes(1);
  });

  it('drops a result if a review is removed while Gemini is running', async () => {
    findFirst
      .mockResolvedValueOnce(hotel)
      .mockResolvedValue({ ...hotel, reviews: hotel.reviews.slice(1) });
    await expect(service.get('hotel')).resolves.toMatchObject({
      status: 'UNAVAILABLE',
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it('returns raw scores during a provider failure and avoids immediate retries', async () => {
    classify.mockRejectedValue(new Error('timeout'));
    const expected = {
      status: 'UNAVAILABLE',
      stats: { count: 3, average: 8, sampleCount: 3 },
    };
    await expect(service.get('hotel')).resolves.toEqual(expected);
    await expect(service.get('hotel')).resolves.toEqual(expected);
    expect(classify).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });
});
