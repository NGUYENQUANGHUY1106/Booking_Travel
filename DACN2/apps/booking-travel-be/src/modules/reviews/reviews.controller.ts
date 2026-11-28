import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateReviewDto,
  ReviewImageUploadDto,
  UpdateReviewDto,
} from './review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.HOTEL_OWNER)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('me')
  mine(@CurrentUserId() userId: string) {
    return this.reviews.myReviews(userId);
  }

  @Get('me/:reviewId')
  detail(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string) {
    return this.reviews.myReview(userId, reviewId);
  }

  @Patch('me/:reviewId')
  update(
    @CurrentUserId() userId: string,
    @Param('reviewId') reviewId: string,
    @Body() input: UpdateReviewDto,
  ) {
    return this.reviews.update(userId, reviewId, input);
  }

  @Delete('me/:reviewId')
  @HttpCode(204)
  remove(@CurrentUserId() userId: string, @Param('reviewId') reviewId: string) {
    return this.reviews.remove(userId, reviewId);
  }

  @Get('bookings/:bookingId')
  async forBooking(
    @CurrentUserId() userId: string,
    @Param('bookingId') bookingId: string,
  ) {
    const booking = await this.reviews.forBooking(userId, bookingId);
    return {
      hotelName: booking.hotelNameSnapshot ?? booking.hotel.name,
      review: booking.review?.deletedAt ? null : booking.review,
      reviewDeleted: Boolean(booking.review?.deletedAt),
    };
  }

  @Post('bookings/:bookingId')
  @UseGuards(ThrottlerGuard)
  create(
    @CurrentUserId() userId: string,
    @Param('bookingId') bookingId: string,
    @Body() input: CreateReviewDto,
  ) {
    return this.reviews.create(userId, bookingId, input);
  }

  @Post('bookings/:bookingId/images/presign')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  presign(
    @CurrentUserId() userId: string,
    @Param('bookingId') bookingId: string,
    @Body() input: ReviewImageUploadDto,
  ) {
    return this.reviews.presign(userId, bookingId, input);
  }
}

@ApiTags('Reviews')
@Controller('hotels/:hotelId/reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param('hotelId') hotelId: string) {
    return this.reviews.publicReviews(hotelId);
  }
}
