import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OwnerPromotionListDto } from './owner-promotion.dto';
import { OwnerPromotionsService } from './owner-promotions.service';

@ApiTags('Admin Owner Promotions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('PROMOTION_MANAGEMENT')
@Controller('admin/owner-promotions')
export class AdminOwnerPromotionsController {
  constructor(private readonly promotions: OwnerPromotionsService) {}

  @Get()
  list(@Query() query: OwnerPromotionListDto) {
    return this.promotions.adminList(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.promotions.adminGet(id);
  }
}
