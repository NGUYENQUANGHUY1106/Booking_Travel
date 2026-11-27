import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, HotelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { CreateReviewDto, ReplyDto } from './reviews.controller';

const publicSelect = {
  id: true,
  hotelId: true,
  rating: true,
  title: true,
  content: true,
  createdAt: true,
  author: { select: { fullName: true } },
  reply: {
    select: {
      content: true,
      createdAt: true,
      updatedAt: true,
      isVisible: true,
    },
  },
} satisfies Prisma.ReviewSelect;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(userId: string, input: CreateReviewDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: input.bookingId, userId, status: BookingStatus.COMPLETED },
      select: { id: true, hotelId: true, hotel: { select: { ownerId: true } } },
    });
    if (!booking)
      throw new NotFoundException('Không tìm thấy kỳ lưu trú đã hoàn thành.');
    if (booking.hotel.ownerId === userId)
      throw new ForbiddenException('Không thể đánh giá khách sạn của mình.');
    try {
      return await this.prisma.review.create({
        data: {
          bookingId: booking.id,
          hotelId: booking.hotelId,
          authorId: userId,
          rating: input.rating,
          title: input.title?.trim() || null,
          content: this.content(input.content),
        },
        select: publicSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Booking này đã được đánh giá.');
      }
      throw error;
    }
  }

  async publicList(hotelId: string, pageValue?: string) {
    const page = this.page(pageValue);
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: hotelId,
        status: HotelStatus.APPROVED,
        isVisible: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    const rows = await this.prisma.review.findMany({
      where: { hotelId, isVisible: true },
      select: publicSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * 20,
      take: 20,
    });
    return rows.map(({ reply, ...review }) => ({
      ...review,
      reply: reply?.isVisible ? reply : null,
    }));
  }

  async mine(userId: string) {
    const rows = await this.prisma.review.findMany({
      where: { authorId: userId },
      select: {
        ...publicSelect,
        isVisible: true,
        hotel: { select: { name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return rows.map(({ reply, ...review }) => ({
      ...review,
      reply: review.isVisible && reply?.isVisible ? reply : null,
    }));
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
    return this.prisma.review.findMany({
      where: {
        hotel: { ownerId: userId, deletedAt: null },
        ...(hotelId ? { hotelId } : {}),
      },
      select: {
        ...publicSelect,
        isVisible: true,
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
  }

  async reply(userId: string, id: string, input: ReplyDto, editing: boolean) {
    const review = await this.prisma.review.findFirst({
      where: {
        id,
        hotel: {
          ownerId: userId,
          status: HotelStatus.APPROVED,
          isVisible: true,
          deletedAt: null,
        },
      },
      select: {
        id: true,
        isVisible: true,
        reply: { select: { id: true, version: true, isVisible: true } },
      },
    });
    if (!review)
      throw new NotFoundException('Không tìm thấy đánh giá của khách sạn bạn.');
    if (!review.isVisible) throw new ConflictException('Đánh giá đã bị ẩn.');
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
          select: { authorId: true },
        });
        await this.prisma.userNotification.create({
          data: {
            userId: author.authorId,
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

  async reportReply(userId: string, reviewId: string, rawReason: string) {
    const reason = rawReason?.trim();
    if (!reason || reason.length > 500)
      throw new BadRequestException('Vui lòng nhập lý do báo cáo.');
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        isVisible: true,
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
        data: { replyId: review.reply.id, reporterId: userId, reason },
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

  adminList() {
    return this.prisma.review.findMany({
      select: {
        ...publicSelect,
        isVisible: true,
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
        hotel: { select: { name: true } },
        actions: {
          select: { id: true, action: true, createdAt: true, actorId: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async setVisibility(actorId: string, id: string, visible: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.review.updateMany({
        where: { id },
        data: { isVisible: visible },
      });
      if (!result.count)
        throw new NotFoundException('Không tìm thấy đánh giá.');
      await tx.reviewActionAudit.create({
        data: {
          reviewId: id,
          actorId,
          action: visible ? 'REVIEW_SHOW' : 'REVIEW_HIDE',
        },
      });
    });
    return { id, isVisible: visible };
  }
  async setReplyVisibility(actorId: string, id: string, visible: boolean) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.reviewReply.updateMany({
        where: { reviewId: id },
        data: { isVisible: visible },
      });
      if (!result.count)
        throw new NotFoundException('Không tìm thấy phản hồi.');
      await tx.reviewActionAudit.create({
        data: {
          reviewId: id,
          actorId,
          action: visible ? 'REPLY_SHOW' : 'REPLY_HIDE',
        },
      });
    });
    return { reviewId: id, isVisible: visible };
  }
}
