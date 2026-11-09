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
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { HotelQueryDto } from './dto/hotel-query.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';
import { HotelsService } from './hotels.service';
import { HotelModerationService } from './hotel-moderation.service';
import { ReviewHotelSubmissionDto } from './dto/review-hotel-submission.dto';

@ApiTags('Hotels')
@UseGuards(AccessTokenGuard, RolesGuard, OwnershipGuard)
@Controller('hotels')
export class HotelsController {
  constructor(
    private readonly hotels: HotelsService,
    private readonly moderation: HotelModerationService,
  ) {}

  @Get('review/submissions')
  @Roles(UserRole.ADMIN)
  @Permissions('HOTEL_REVIEW')
  reviewSubmissions() {
    return this.moderation.pending();
  }

  @Get('review/submissions/:submissionId')
  @Roles(UserRole.ADMIN)
  @Permissions('HOTEL_REVIEW')
  reviewSubmission(@Param('submissionId') id: string) {
    return this.moderation.detail(id);
  }

  @Post('review/submissions/:submissionId/decision')
  @Roles(UserRole.ADMIN)
  @Permissions('HOTEL_REVIEW')
  reviewDecision(
    @Param('submissionId') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: ReviewHotelSubmissionDto,
  ) {
    return this.moderation.decide(id, user, input);
  }

  @Get()
  @Public()
  list(@Query() query: HotelQueryDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.hotels.list(query, user);
  }

  @Get(':id')
  @Public()
  get(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.hotels.get(id, user);
  }

  @Post()
  @Roles(UserRole.HOTEL_OWNER)
  create(
    @Body() input: CreateHotelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotels.create(user, input);
  }

  @Patch(':id')
  @Roles(UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'hotel', param: 'id' })
  update(
    @Param('id') id: string,
    @Body() input: UpdateHotelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotels.update(id, user, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'hotel', param: 'id' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hotels.remove(id, user);
  }
}
