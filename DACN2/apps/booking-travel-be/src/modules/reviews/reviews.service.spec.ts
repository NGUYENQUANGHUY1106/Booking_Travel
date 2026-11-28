import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { CreateReviewDto } from './review.dto';
import { ReviewsService } from './reviews.service';

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
