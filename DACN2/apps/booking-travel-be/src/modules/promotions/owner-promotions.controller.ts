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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  OwnerPromotionActionDto,
  OwnerPromotionInputDto,
  OwnerPromotionListDto,
  OwnerPromotionPreviewDto,
  OwnerPromotionUpdateDto,
} from './owner-promotion.dto';
import { OwnerPromotionsService } from './owner-promotions.service';

@ApiTags('Owner promotions')
@ApiBearerAuth()
@Roles(UserRole.HOTEL_OWNER)
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('owner/hotels/:hotelId/promotions')
export class OwnerPromotionsController {
  constructor(private readonly promotions: OwnerPromotionsService) {}

  @Get() list(
    @Param('hotelId') hotelId: string,
    @Query() query: OwnerPromotionListDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotions.list(hotelId, query, user);
  }
  @Get(':id') get(
    @Param('hotelId') hotelId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotions.get(hotelId, id, user);
  }
  @Post() create(
    @Param('hotelId') hotelId: string,
    @Body() input: OwnerPromotionInputDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotions.create(hotelId, input, user);
  }
  @Post('preview') preview(
    @Param('hotelId') hotelId: string,
    @Body() input: OwnerPromotionPreviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotions.previewDraft(hotelId, input, user);
  }
  @Patch(':id') update(
    @Param('hotelId') hotelId: string,
    @Param('id') id: string,
    @Body() input: OwnerPromotionUpdateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotions.update(hotelId, id, input, user);
  }
  @Post(':id/activate') activate(
    @Param('hotelId') hotelId: string,
    @Param('id') id: string,
    @Body() input: OwnerPromotionActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotions.action(hotelId, id, 'activate', input, user);
  }
  @Post(':id/pause') pause(
    @Param('hotelId') hotelId: string,
    @Param('id') id: string,
    @Body() input: OwnerPromotionActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotions.action(hotelId, id, 'pause', input, user);
  }
  @Post(':id/end') end(
    @Param('hotelId') hotelId: string,
    @Param('id') id: string,
    @Body() input: OwnerPromotionActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.promotions.action(hotelId, id, 'end', input, user);
  }
}
