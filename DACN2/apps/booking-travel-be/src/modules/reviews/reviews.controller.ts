import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ContentReportReason, UserRole } from '@prisma/client';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateReviewDto,
  ReviewImageUploadDto,
  UpdateReviewDto,
} from './review.dto';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { ReviewsService } from './reviews.service';

export class ReplyDto {
  @IsString() @MaxLength(2000) content!: string;
  @IsOptional() @IsInt() @Min(1) version?: number;
}

export class ReportReplyDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
  @IsOptional() @IsEnum(ContentReportReason) category?: ContentReportReason;
}

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
  @Get('owner')
  @Roles(UserRole.HOTEL_OWNER)
  owner(
    @CurrentUserId() userId: string,
    @Query('hotelId') hotelId?: string,
    @Query('page') page?: string,
  ) {
    return this.reviews.ownerList(userId, hotelId, page);
  }

  @Post(':id/reply')
  @Roles(UserRole.HOTEL_OWNER)
  reply(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() input: ReplyDto,
  ) {
    return this.reviews.reply(userId, id, input, false);
  }

  @Patch(':id/reply')
  @Roles(UserRole.HOTEL_OWNER)
  editReply(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() input: ReplyDto,
  ) {
    return this.reviews.reply(userId, id, input, true);
  }

  @Post(':id/reply/report')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  reportReply(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() input: ReportReplyDto,
  ) {
    return this.reviews.reportReply(userId, id, input);
  }
}

@ApiTags('Admin review moderation')
@Controller('admin/reviews')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('HOTEL_REVIEW')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Get() list() {
    return this.reviews.adminList();
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
