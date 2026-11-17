import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OwnerBookingNoteDto } from './dto/owner-booking-note.dto';
import { OwnerBookingQueryDto } from './dto/owner-booking-query.dto';
import { OwnerBookingsService } from './owner-bookings.service';

@ApiTags('Owner Bookings')
@Controller('owner/bookings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.HOTEL_OWNER)
export class OwnerBookingsController {
  constructor(private readonly bookings: OwnerBookingsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OwnerBookingQueryDto,
  ) {
    return this.bookings.list(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.detail(user, id);
  }

  @Patch(':id/internal-note')
  updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: OwnerBookingNoteDto,
  ) {
    return this.bookings.updateNote(user, id, input);
  }
}
