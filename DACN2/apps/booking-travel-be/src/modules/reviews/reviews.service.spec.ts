import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContentReportReason } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

describe('ReviewsService reply authorization and moderation', () => {
  const review = { id: 'review-a', isVisible: true, reply: null };
  const prisma = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    review: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
    reviewReport: { findFirst: jest.fn(), create: jest.fn() },
    reviewReply: { create: jest.fn(), updateMany: jest.fn() },
    reviewActionAudit: { create: jest.fn() },
    userNotification: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ReviewsService(prisma as unknown as PrismaService);

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
    prisma.review.findUniqueOrThrow.mockResolvedValue({ authorId: 'guest-a' });
  });

  it('checks hotel ownership using the authenticated owner and review id', async () => {
    await service.reply('owner-a', 'review-a', { content: 'Cảm ơn' }, false);
    expect(prisma.review.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'review-a',
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
      isVisible: false,
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

  it('rejects a second active report from the same reporter before creating it', async () => {
    prisma.reviewReport.findFirst.mockResolvedValue({ id: 'report-a' });
    await expect(
      service.reportReview('guest-a', 'review-a', {
        reason: ContentReportReason.SPAM,
        description: 'Trùng báo cáo',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$executeRaw).toHaveBeenCalled();
    expect(prisma.reviewReport.create).not.toHaveBeenCalled();
  });
});
