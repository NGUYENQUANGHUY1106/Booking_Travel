import { ConflictException, NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { CreateReviewDto } from './review.dto';
import { ReviewsService } from './reviews.service';

describe('Admin review deletion', () => {
  it.each([false, true])(
    'preserves audit history and updates totals only for a visible review (hidden=%s)',
    async (hidden) => {
      const tx = {
        $queryRaw: jest.fn(),
        review: {
          findFirst: jest.fn().mockResolvedValue({
            hotelId: 'hotel',
            rating: 8,
            hiddenAt: hidden ? new Date() : null,
          }),
          update: jest.fn(),
        },
        hotel: { update: jest.fn() },
        reviewActionAudit: { create: jest.fn() },
        reportModerationAction: { create: jest.fn() },
      };
      const prisma = {
        $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
      };
      const service = new ReviewsService(
        prisma as unknown as PrismaService,
        {} as StorageService,
      );
      await service.moderate('admin', 'review', {
        action: 'DELETE',
        reason: 'Vi phạm quy định.',
      });
      expect(tx.review.update).toHaveBeenCalledWith({
        where: { id: 'review' },
        data: { deletedAt: expect.any(Date) as Date },
      });
      expect(tx.hotel.update).toHaveBeenCalledTimes(hidden ? 0 : 1);
      expect(tx.reportModerationAction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetId: 'review',
            actorId: 'admin',
            action: 'DELETE',
          }) as object,
        }),
      );
    },
  );
});

describe('ST-REV-01 verified stay', () => {
  const booking = {
    id: 'stay',
    status: 'COMPLETED',
    review: null,
    hotel: { id: 'hotel', ownerId: 'owner', name: 'Biển Xanh' },
  };
  const input = {
    rating: 9,
    cleanliness: 8,
    location: 9,
    service: 10,
    facilities: 7,
    comfort: 9,
    value: 9,
    comment: 'Thoải mái',
  };
  const tx = {
    review: { create: jest.fn() },
    hotel: { update: jest.fn() },
    userNotification: { create: jest.fn() },
  };
  const prisma = {
    booking: { findFirst: jest.fn() },
    $transaction: jest.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  const storage = { verifyReviewImage: jest.fn() };
  const service = new ReviewsService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.booking.findFirst.mockResolvedValue(booking);
    tx.review.create.mockResolvedValue({ id: 'review', rating: input.rating });
    storage.verifyReviewImage.mockResolvedValue(
      'https://images.example/review.jpg',
    );
  });

  it('uses the authenticated booker, checks the image, and writes the score and owner notification in the same transaction', async () => {
    const imageId = '00000000-0000-4000-8000-000000000000.jpg';
    await expect(
      service.create('guest', 'stay', { ...input, imageIds: [imageId] }),
    ).resolves.toMatchObject({ id: 'review', verifiedStay: true });
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'stay', userId: 'guest' } }),
    );
    expect(storage.verifyReviewImage).toHaveBeenCalledWith(
      `review-images/guest/stay/${imageId}`,
      'image/jpeg',
      5 * 1024 * 1024,
    );
    expect(tx.review.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          ...input,
          bookingId: 'stay',
          userId: 'guest',
          hotelId: 'hotel',
          images: ['https://images.example/review.jpg'],
        },
      }),
    );
    expect(tx.hotel.update).toHaveBeenCalledWith({
      where: { id: 'hotel' },
      data: {
        reviewCount: { increment: 1 },
        reviewRatingSum: { increment: 9 },
      },
    });
    expect(tx.userNotification.create).toHaveBeenCalledWith({
      data: {
        userId: 'owner',
        type: 'HOTEL_REVIEW_CREATED',
        title: 'Khách sạn có đánh giá mới',
        body: 'Biển Xanh vừa nhận một đánh giá đã xác minh lưu trú.',
        data: { hotelId: 'hotel', reviewId: 'review' },
      },
    });
  });

  it.each(['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'CANCELLED'])(
    'rejects %s booking',
    async (status) => {
      prisma.booking.findFirst.mockResolvedValue({ ...booking, status });
      await expect(
        service.create('guest', 'stay', input),
      ).rejects.toHaveProperty('status', 403);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it('prevents cross-account access and self-review', async () => {
    prisma.booking.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create('stranger', 'stay', input),
    ).rejects.toHaveProperty('status', 404);
    await expect(service.create('owner', 'stay', input)).rejects.toHaveProperty(
      'status',
      403,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects duplicate and concurrent submissions before updating totals', async () => {
    prisma.booking.findFirst.mockResolvedValueOnce({
      ...booking,
      review: { id: 'already-created' },
    });
    await expect(service.create('guest', 'stay', input)).rejects.toHaveProperty(
      'status',
      409,
    );
    tx.review.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(service.create('guest', 'stay', input)).rejects.toHaveProperty(
      'status',
      409,
    );
    expect(tx.hotel.update).not.toHaveBeenCalled();
    expect(tx.userNotification.create).not.toHaveBeenCalled();
  });

  it('validates every score and rejects empty comments and arbitrary image URLs', async () => {
    expect(await validate(plainToInstance(CreateReviewDto, input))).toEqual([]);
    const invalid = plainToInstance(CreateReviewDto, {
      ...input,
      rating: 0,
      cleanliness: 11,
      service: 9.5,
      comment: '  ',
      imageIds: ['https://untrusted.example/image.jpg'],
    });
    expect((await validate(invalid)).map(({ property }) => property)).toEqual(
      expect.arrayContaining([
        'rating',
        'cleanliness',
        'service',
        'comment',
        'imageIds',
      ]),
    );
  });
});

describe('ReviewsService reply authorization and moderation', () => {
  const review = { id: 'review-a', hiddenAt: null, reply: null };
  const prisma = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    review: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
    reviewReply: { create: jest.fn(), updateMany: jest.fn() },
    reviewActionAudit: { create: jest.fn() },
    userNotification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ReviewsService(
    prisma as unknown as PrismaService,
    {} as StorageService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.review.findFirst.mockResolvedValue(review);
    prisma.$transaction.mockImplementation(
      async (run: (tx: typeof prisma) => Promise<unknown>) => run(prisma),
    );
    prisma.reviewReply.create.mockResolvedValue({
      id: 'reply-a',
      content: 'Cảm ơn',
    });
    prisma.review.findUniqueOrThrow.mockResolvedValue({ userId: 'guest-a' });
  });

  it('checks hotel ownership using the authenticated owner and review id', async () => {
    await service.reply('owner-a', 'review-a', { content: 'Cảm ơn' }, false);
    expect(prisma.review.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'review-a',
          deletedAt: null,
          hotel: {
            ownerId: 'owner-a',
            status: 'APPROVED',
            isVisible: true,
            deletedAt: null,
          },
        },
      }),
    );
    expect(prisma.reviewReply.create).toHaveBeenCalledTimes(1);
  });

  it('rejects reviews outside the owner scope', async () => {
    prisma.review.findFirst.mockResolvedValue(null);
    await expect(
      service.reply('owner-b', 'review-a', { content: 'Cảm ơn' }, false),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.reviewReply.create).not.toHaveBeenCalled();
  });

  it('rejects hidden reviews and duplicate replies', async () => {
    prisma.review.findFirst.mockResolvedValueOnce({
      ...review,
      hiddenAt: new Date(),
    });
    await expect(
      service.reply('owner-a', 'review-a', { content: 'Cảm ơn' }, false),
    ).rejects.toBeInstanceOf(ConflictException);
    prisma.review.findFirst.mockResolvedValueOnce({
      ...review,
      reply: { id: 'reply-a', version: 1, isVisible: true },
    });
    await expect(
      service.reply('owner-a', 'review-a', { content: 'Cảm ơn' }, false),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires matching version to edit an existing reply', async () => {
    prisma.review.findFirst.mockResolvedValue({
      ...review,
      reply: { id: 'reply-a', version: 2, isVisible: true },
    });
    await expect(
      service.reply(
        'owner-a',
        'review-a',
        { content: 'Sửa phản hồi', version: 1 },
        true,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.reviewReply.updateMany).not.toHaveBeenCalled();
  });
});
