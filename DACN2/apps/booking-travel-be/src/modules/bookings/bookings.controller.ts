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
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Bookings')
@UseGuards(AccessTokenGuard, RolesGuard, OwnershipGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER, UserRole.ADMIN)
  list(
    @Query() query: BookingQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.list(query, user);
  }

  @Get(':id')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER, UserRole.ADMIN)
  @OwnedResource({ resource: 'booking', param: 'id', action: 'read' })
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bookings.get(id, user);
  }

  @Post()
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  create(
    @Body() input: CreateBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.create(user.id, input);
  }

  @Patch(':id/status')
  @Roles(UserRole.HOTEL_OWNER, UserRole.ADMIN)
  @OwnedResource({ resource: 'booking', param: 'id', action: 'manage' })
  updateStatus(
    @Param('id') id: string,
    @Body() input: UpdateBookingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.updateStatus(id, user, input);
  }
}
