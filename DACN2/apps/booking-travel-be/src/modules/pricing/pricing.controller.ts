import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  BasePriceDto,
  DeletePricingRuleDto,
  PricingMonthDto,
  PricingRangeDto,
  PricingRuleDto,
} from './pricing.dto';
import { PricingService } from './pricing.service';

@ApiTags('Owner room pricing')
@Roles(UserRole.HOTEL_OWNER)
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('owner/hotels/:hotelId/rooms/:roomId/pricing')
export class OwnerPricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  month(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Query() query: PricingMonthDto,
  ) {
    return this.pricing.month(user, hotelId, roomId, query.month);
  }

  @Post('preview')
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() input: PricingRuleDto,
  ) {
    return this.pricing.preview(user, hotelId, roomId, input);
  }

  @Put('base')
  base(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() input: BasePriceDto,
  ) {
    return this.pricing.setBase(user, hotelId, roomId, input);
  }

  @Post('rules')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Body() input: PricingRuleDto,
  ) {
    return this.pricing.createRule(user, hotelId, roomId, input);
  }

  @Patch('rules/:ruleId')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Param('ruleId') ruleId: string,
    @Body() input: PricingRuleDto,
  ) {
    return this.pricing.updateRule(user, hotelId, roomId, ruleId, input);
  }

  @Delete('rules/:ruleId')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Param('roomId') roomId: string,
    @Param('ruleId') ruleId: string,
    @Body() input: DeletePricingRuleDto,
  ) {
    return this.pricing.deleteRule(
      user,
      hotelId,
      roomId,
      ruleId,
      input.expectedVersion,
    );
  }
}

@ApiTags('Public room pricing')
@Public()
@Controller('rooms/:roomId/pricing')
export class PublicPricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  range(@Param('roomId') roomId: string, @Query() query: PricingRangeDto) {
    return this.pricing.publicRange(roomId, query);
  }
}
