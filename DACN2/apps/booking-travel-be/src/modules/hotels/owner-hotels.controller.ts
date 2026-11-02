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
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import {
  CreateOwnerHotelDraftDto,
  UpdateOwnerHotelProfileDto,
} from './dto/owner-hotel-profile.dto';
import { HotelsService } from './hotels.service';

@ApiTags('Owner hotels')
@Roles(UserRole.HOTEL_OWNER)
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('owner/hotels')
export class OwnerHotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.hotels.listOwnerProfiles(user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hotels.getOwnerProfile(id, user);
  }

  @Post()
  create(
    @Body() input: CreateOwnerHotelDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotels.createOwnerDraft(user, input);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateOwnerHotelProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hotels.updateOwnerProfile(id, user, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.hotels.remove(id, user);
  }
}
