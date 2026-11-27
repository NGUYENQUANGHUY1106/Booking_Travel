import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OwnerGuestsService } from './owner-guests.service';

@ApiTags('Owner Guests')
@Controller('owner/guests')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.HOTEL_OWNER)
export class OwnerGuestsController {
  constructor(private readonly guests: OwnerGuestsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query()
    query: { hotelId?: string; search?: string; page?: string; limit?: string },
  ) {
    return this.guests.list(user.id, query);
  }

  @Get(':hotelId/:userId')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Param('userId') userId: string,
    @Query('page') page?: string,
  ) {
    return this.guests.detail(user.id, hotelId, userId, page);
  }

  @Post(':hotelId/:userId/conversation')
  openConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hotelId') hotelId: string,
    @Param('userId') userId: string,
  ) {
    return this.guests.openConversation(user.id, hotelId, userId);
  }
}
