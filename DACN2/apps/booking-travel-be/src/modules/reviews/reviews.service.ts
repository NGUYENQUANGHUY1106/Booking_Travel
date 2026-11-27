import {
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
  REVIEW_IMAGE_MAX_BYTES,
  REVIEW_IMAGE_TYPES,
  ReviewImageUploadDto,
  UpdateReviewDto,
} from './review.dto';

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
      select: REVIEW_FIELDS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 20,
    });
    return items.map((review) => ({ ...review, verifiedStay: true }));
  }

  async myReviews(userId: string) {
    return this.prisma.review.findMany({
      where: { userId, deletedAt: null },
      select: OWN_REVIEW_FIELDS,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}
