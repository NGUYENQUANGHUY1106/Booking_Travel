import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsInt,
  IsBoolean,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ReviewsService } from './reviews.service';

export class CreateReviewDto {
  @IsString() bookingId!: string;
  @IsInt() @Min(1) @Max(10) rating!: number;
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsString() @MaxLength(2000) content!: string;
}

export class ReplyDto {
  @IsString() @MaxLength(2000) content!: string;
  @IsOptional() @IsInt() @Min(1) version?: number;
}

export class VisibilityDto {
  @IsBoolean()
  visible!: boolean;
}

export class ReportReplyDto {
  @IsString()
  @MaxLength(500)
  reason!: string;
}

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(AccessTokenGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('hotel/:hotelId')
  @Public()
  hotel(@Param('hotelId') hotelId: string, @Query('page') page?: string) {
    return this.reviews.publicList(hotelId, page);
  }

  @Get('mine')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  mine(@CurrentUserId() userId: string) {
    return this.reviews.mine(userId);
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

  @Post()
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  create(@CurrentUserId() userId: string, @Body() input: CreateReviewDto) {
    return this.reviews.create(userId, input);
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
  reportReply(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() input: ReportReplyDto,
  ) {
    return this.reviews.reportReply(userId, id, input.reason);
  }
}

@ApiTags('Admin review moderation')
@Controller('admin/reviews')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Get() list() {
    return this.reviews.adminList();
  }
  @Patch(':id/visibility') visibility(
    @CurrentUserId() actorId: string,
    @Param('id') id: string,
    @Body() input: VisibilityDto,
  ) {
    return this.reviews.setVisibility(actorId, id, input.visible);
  }
  @Patch(':id/reply/visibility') replyVisibility(
    @CurrentUserId() actorId: string,
    @Param('id') id: string,
    @Body() input: VisibilityDto,
  ) {
    return this.reviews.setReplyVisibility(actorId, id, input.visible);
  }
}
