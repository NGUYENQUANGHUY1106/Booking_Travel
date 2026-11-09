import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AdminHotelManagementService } from './admin-hotel-management.service';
import {
  AdminHotelDecisionDto,
  AdminHotelListDto,
} from './dto/admin-hotel-management.dto';

@ApiTags('Admin Hotel Management')
@ApiBearerAuth()
@Controller('admin/hotels')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('HOTEL_REVIEW')
export class AdminHotelManagementController {
  constructor(private readonly management: AdminHotelManagementService) {}

  @Get()
  list(@Query() query: AdminHotelListDto) {
    return this.management.list(query);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.management.detail(id);
  }

  @Post(':id/decision')
  decide(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: AdminHotelDecisionDto,
  ) {
    return this.management.decide(id, actor, input);
  }
}
