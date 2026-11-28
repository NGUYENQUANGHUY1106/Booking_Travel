import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, HotelStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorageService } from '../../infrastructure/storage/storage.service';
import {
  CreateReviewDto,
  ModerateReviewDto,
  REVIEW_IMAGE_MAX_BYTES,
  REVIEW_IMAGE_TYPES,
  ReviewImageUploadDto,
  UpdateReviewDto,
} from './review.dto';

import type { ReplyDto, ReportReplyDto } from './reviews.controller';

const REVIEW_FIELDS = {
  id: true,
  rating: true,
  cleanliness: true,
  location: true,
  service: true,
  facilities: true,
  comfort: true,
  value: true,
  comment: true,
  images: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReviewSelect;

const OWN_REVIEW_FIELDS = {
  ...REVIEW_FIELDS,
  bookingId: true,
  moderationLockedAt: true,
  hiddenAt: true,
  hotel: { select: { name: true } },
} satisfies Prisma.ReviewSelect;

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async forBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, userId },
      select: {
        id: true,
        status: true,
        hotelNameSnapshot: true,
        hotel: { select: { id: true, ownerId: true, name: true } },
        review: {
          select: {
            ...REVIEW_FIELDS,
            deletedAt: true,
            hiddenAt: true,
            moderationLockedAt: true,
          },
        },
      },
    });
    if (!booking) throw new NotFoundException('Không tìm thấy đặt phòng.');
    if (booking.hotel.ownerId === userId)
      throw new ForbiddenException('Không thể tự đánh giá khách sạn của mình.');
    if (booking.status !== BookingStatus.COMPLETED)
      throw new ForbiddenException(
        'Chỉ có thể đánh giá sau khi hoàn tất lưu trú.',
      );

    return booking;
  }

  async myReview(userId: string, id: string) {
    const review = await this.prisma.review.findFirst({
      where: { id, userId, deletedAt: null },
      select: OWN_REVIEW_FIELDS,
    });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá.');
    return review;
  }

  private async lockOwnReview(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    await tx.$queryRaw`SELECT id FROM "Review" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
    const review = await tx.review.findFirst({
      where: { id, userId, deletedAt: null },
      select: {
        id: true,
        rating: true,
        hotelId: true,
        hiddenAt: true,
        moderationLockedAt: true,
      },
    });
    if (!review) throw new NotFoundException('Không tìm thấy đánh giá.');
    if (review.moderationLockedAt)
      throw new ConflictException('Đánh giá đang bị khóa kiểm duyệt.');
    return review;
  }

  async update(userId: string, id: string, input: UpdateReviewDto) {
    return this.prisma.$transaction(async (tx) => {
      const previous = await this.lockOwnReview(tx, userId, id);
      const review = await tx.review.update({
        where: { id },
        data: input,
        select: OWN_REVIEW_FIELDS,
      });
      if (!previous.hiddenAt && review.rating !== previous.rating) {
        await tx.hotel.update({
          where: { id: previous.hotelId },
          data: {
            reviewRatingSum: { increment: review.rating - previous.rating },
          },
        });
      }
      return review;
    });
  }

  async remove(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const review = await this.lockOwnReview(tx, userId, id);
      await tx.review.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      if (!review.hiddenAt) {
        await tx.hotel.update({
          where: { id: review.hotelId },
          data: {
            reviewCount: { decrement: 1 },
            reviewRatingSum: { decrement: review.rating },
          },
        });
      }
    });
  }

  private imageKey(userId: string, bookingId: string, imageId: string) {
    return `review-images/${userId}/${bookingId}/${imageId}`;
  }

  async presign(
    userId: string,
    bookingId: string,
    { extension, sizeBytes }: ReviewImageUploadDto,
  ) {
    const booking = await this.forBooking(userId, bookingId);
    if (booking.review)
      throw new ConflictException('Đặt phòng này đã được đánh giá.');
    const imageId = `${randomUUID()}.${extension}`;
    const upload = await this.storage.createReviewImageUploadUrl(
      this.imageKey(userId, bookingId, imageId),
      REVIEW_IMAGE_TYPES[extension],
      sizeBytes,
    );
    return {
      imageId,
      uploadUrl: upload.uploadUrl,
      contentType: upload.contentType,
    };
  }

  async create(userId: string, bookingId: string, input: CreateReviewDto) {
    const booking = await this.forBooking(userId, bookingId);
    if (booking.review)
      throw new ConflictException('Đặt phòng này đã được đánh giá.');
    const { imageIds, ...scoresAndComment } = input;
    const images = await Promise.all(
      (imageIds ?? []).map((imageId) => {
        const extension = imageId
          .split('.')
          .at(-1) as keyof typeof REVIEW_IMAGE_TYPES;
        return this.storage.verifyReviewImage(
          this.imageKey(userId, bookingId, imageId),
          REVIEW_IMAGE_TYPES[extension],
          REVIEW_IMAGE_MAX_BYTES,
        );
      }),
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        const review = await tx.review.create({
          data: {
            bookingId,
            hotelId: booking.hotel.id,
            userId,
            ...scoresAndComment,
            images,
          },
          select: REVIEW_FIELDS,
        });
        await tx.hotel.update({
          where: { id: booking.hotel.id },
          data: {
            reviewCount: { increment: 1 },
            reviewRatingSum: { increment: review.rating },
          },
        });
        await tx.userNotification.create({
          data: {
            userId: booking.hotel.ownerId,
            type: 'HOTEL_REVIEW_CREATED',
            title: 'Khách sạn có đánh giá mới',
            body: `${booking.hotel.name} vừa nhận một đánh giá đã xác minh lưu trú.`,
            data: { hotelId: booking.hotel.id, reviewId: review.id },
          },
        });
        return { ...review, verifiedStay: true };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Đặt phòng này đã được đánh giá.');
      throw error;
    }
  }

  async publicReviews(hotelId: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: hotelId,
        deletedAt: null,
        status: HotelStatus.APPROVED,
        isVisible: true,
      },
      select: { id: true },
    });
    if (!hotel)
      throw new NotFoundException('Không tìm thấy khách sạn công khai.');
    const items = await this.prisma.review.findMany({
      where: {
        hotelId,
        deletedAt: null,
        hiddenAt: null,
        hotel: {
          deletedAt: null,
          status: HotelStatus.APPROVED,
          isVisible: true,
        },
      },
      select: {
        ...REVIEW_FIELDS,
        reply: { select: { content: true, isVisible: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    return items.map(({ reply, ...review }) => ({
      ...review,
      reply: reply?.isVisible ? { content: reply.content } : null,
      verifiedStay: true,
    }));
  }

  async myReviews(userId: string) {
    const items = await this.prisma.review.findMany({
      where: { userId, deletedAt: null },
      select: {
        ...OWN_REVIEW_FIELDS,
        reply: { select: { content: true, isVisible: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return items.map(({ reply, ...review }) => ({
      ...review,
      reply:
        !review.hiddenAt && reply?.isVisible
          ? { content: reply.content }
          : null,
    }));
  }

  private content(raw: string) {
    const content = raw?.trim();
    if (
      !content ||
      content.length > 2000 ||
      Array.from(content).some((char) => {
        const code = char.charCodeAt(0);
        return code < 32 && code !== 9 && code !== 10 && code !== 13;
      })
    ) {
      throw new BadRequestException(
        'Nội dung phải có từ 1 đến 2000 ký tự hợp lệ.',
      );
    }
    return content;
  }

  private page(value?: string) {
    const page = Number(value ?? '1');
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
      throw new BadRequestException('Trang không hợp lệ.');
    return page;
  }

  async ownerList(userId: string, hotelId?: string, pageValue?: string) {
    const page = this.page(pageValue);
    if (hotelId) {
      const hotel = await this.prisma.hotel.findFirst({
        where: { id: hotelId, ownerId: userId, deletedAt: null },
        select: { id: true },
      });
      if (!hotel)
        throw new NotFoundException('Không tìm thấy khách sạn của bạn.');
    }
    const rows = await this.prisma.review.findMany({
      where: {
        deletedAt: null,
        hotel: { ownerId: userId, deletedAt: null },
        ...(hotelId ? { hotelId } : {}),
      },
      select: {
        ...REVIEW_FIELDS,
        user: { select: { fullName: true } },
        hiddenAt: true,
        reply: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            updatedAt: true,
            isVisible: true,
            version: true,
          },
        },
        hotel: { select: { name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 20,
      take: 20,
    });
    return rows.map(({ comment, user, hiddenAt, ...review }) => ({
      ...review,
      content: comment,
      author: user,
      isVisible: hiddenAt === null,
    }));
  }

  async reply(userId: string, id: string, input: ReplyDto, editing: boolean) {
    const review = await this.prisma.review.findFirst({
      where: {
        id,
        deletedAt: null,
        hotel: {
          ownerId: userId,
          status: HotelStatus.APPROVED,
          isVisible: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        hiddenAt: true,
        reply: { select: { id: true, version: true, isVisible: true } },
      },
    });
    if (!review)
      throw new NotFoundException('Không tìm thấy đánh giá của khách sạn bạn.');
    if (review.hiddenAt) throw new ConflictException('Đánh giá đã bị ẩn.');
    const content = this.content(input.content);
    if (editing) {
      if (!review.reply) throw new NotFoundException('Chưa có phản hồi.');
      if (!review.reply.isVisible)
        throw new ConflictException('Phản hồi đã bị ẩn; không thể chỉnh sửa.');
      if (input.version !== review.reply.version)
        throw new ConflictException(
          'Phản hồi đã thay đổi. Tải lại trước khi sửa.',
        );
      await this.prisma.$transaction(async (tx) => {
        const updated = await tx.reviewReply.updateMany({
          where: {
            id: review.reply!.id,
            version: input.version,
            isVisible: true,
          },
          data: { content, version: { increment: 1 } },
        });
        if (!updated.count)
          throw new ConflictException(
            'Phản hồi đã thay đổi. Tải lại trước khi sửa.',
          );
        await tx.reviewActionAudit.create({
          data: { reviewId: id, actorId: userId, action: 'REPLY_EDIT' },
        });
      });
      return this.prisma.reviewReply.findUnique({
        where: { id: review.reply.id },
      });
    }
    if (review.reply) throw new ConflictException('Đánh giá đã có phản hồi.');
    try {
      const reply = await this.prisma.$transaction(async (tx) => {
        const created = await tx.reviewReply.create({
          data: { reviewId: id, authorId: userId, content },
        });
        await tx.reviewActionAudit.create({
          data: { reviewId: id, actorId: userId, action: 'REPLY_CREATE' },
        });
        return created;
      });
      try {
        const author = await this.prisma.review.findUniqueOrThrow({
          where: { id },
          select: { userId: true },
        });
        await this.prisma.userNotification.create({
          data: {
            userId: author.userId,
            type: 'REVIEW_REPLY',
            title: 'Khách sạn đã phản hồi đánh giá',
            body: 'Xem phản hồi mới cho đánh giá của bạn.',
            data: { reviewId: id },
          },
        });
      } catch {
        // A notification failure must not turn a saved reply into a retryable write.
      }
      return reply;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Đánh giá đã có phản hồi.');
      throw error;
    }
  }

  async reportReply(userId: string, reviewId: string, input: ReportReplyDto) {
    const reason = input.reason?.trim();
    if (!reason || reason.length > 500)
      throw new BadRequestException('Vui lòng nhập lý do báo cáo.');
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        deletedAt: null,
        hiddenAt: null,
        hotel: {
          status: HotelStatus.APPROVED,
          isVisible: true,
          deletedAt: null,
        },
      },
      select: { reply: { select: { id: true, isVisible: true } } },
    });
    if (!review?.reply?.isVisible)
      throw new NotFoundException('Không tìm thấy phản hồi công khai.');
    try {
      return await this.prisma.reviewReplyReport.create({
        data: {
          replyId: review.reply.id,
          reporterId: userId,
          reason,
          category: input.category ?? 'OTHER',
          description: reason,
        },
        select: { id: true, createdAt: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Bạn đã báo cáo phản hồi này.');
      throw error;
    }
  }

  async moderate(
    actorId: string,
    id: string,
    { action, reason }: ModerateReviewDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Review" WHERE id = ${id} FOR UPDATE`;
      const review = await tx.review.findFirst({
        where: { id, deletedAt: null },
        select: { hotelId: true, rating: true, hiddenAt: true },
      });
      if (!review) throw new NotFoundException('Không tìm thấy đánh giá.');
      const wasVisible = !review.hiddenAt;
      const isVisible = action === 'RESTORE';
      if (action !== 'DELETE' && wasVisible === isVisible)
        throw new ConflictException('Đánh giá đã ở trạng thái này.');

      const now = new Date();
      await tx.review.update({
        where: { id },
        data:
          action === 'DELETE'
            ? { deletedAt: now }
            : {
                hiddenAt: isVisible ? null : now,
                moderationLockedAt: isVisible ? null : now,
              },
      });
      if (wasVisible !== isVisible) {
        const change = isVisible ? 1 : -1;
        await tx.hotel.update({
          where: { id: review.hotelId },
          data: {
            reviewCount: { increment: change },
            reviewRatingSum: { increment: change * review.rating },
          },
        });
      }
      await tx.reviewActionAudit.create({
        data: {
          reviewId: id,
          actorId,
          action: isVisible ? 'REVIEW_SHOW' : `REVIEW_${action}`,
        },
      });
      await tx.reportModerationAction.create({
        data: {
          targetType: 'REVIEW',
          targetId: id,
          reportId: '',
          actorId,
          action,
          reason,
          beforeState: wasVisible ? 'VISIBLE' : 'HIDDEN',
          afterState:
            action === 'DELETE' ? 'DELETED' : isVisible ? 'VISIBLE' : 'HIDDEN',
          requestId: randomUUID(),
        },
      });
      return { id, action, isVisible };
    });
  }

  async adminList(after?: string) {
    const rows = await this.prisma.review.findMany({
      where: { deletedAt: null },
      select: {
        ...REVIEW_FIELDS,
        user: { select: { fullName: true } },
        hiddenAt: true,
        reply: {
          select: {
            id: true,
            content: true,
            isVisible: true,
            authorId: true,
            createdAt: true,
            updatedAt: true,
            reports: {
              select: {
                id: true,
                reason: true,
                createdAt: true,
                reporterId: true,
              },
            },
          },
        },
        hotel: { select: { id: true, name: true } },
        actions: {
          select: { id: true, action: true, createdAt: true, actorId: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      take: 100,
    });
    return rows.map(({ comment, user, hiddenAt, ...review }) => ({
      ...review,
      content: comment,
      author: user,
      isVisible: hiddenAt === null,
    }));
  }
}
