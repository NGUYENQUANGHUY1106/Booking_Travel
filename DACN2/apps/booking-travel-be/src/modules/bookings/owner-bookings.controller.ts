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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { OwnerBookingNoteDto } from './dto/owner-booking-note.dto';
import { OwnerBookingQueryDto } from './dto/owner-booking-query.dto';
import { OwnerBookingsService } from './owner-bookings.service';
import { OwnerStayService } from './owner-stay.service';
import {
  CheckInOwnerStayDto,
  CheckOutOwnerStayDto,
  ConfirmPropertyCollectionDto,
  VerifyOwnerStayDto,
} from './dto/owner-stay.dto';

@ApiTags('Owner Bookings')
@Controller('owner/bookings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.HOTEL_OWNER)
export class OwnerBookingsController {
  constructor(
    private readonly bookings: OwnerBookingsService,
    private readonly stay: OwnerStayService,
  ) {}

  @Post('verify')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: VerifyOwnerStayDto,
  ) {
    return this.stay.verify(user, input);
  }

  @Post(':id/check-in')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: CheckInOwnerStayDto,
  ) {
    return this.stay.checkIn(user, id, input);
  }

  @Post(':id/check-out')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: CheckOutOwnerStayDto,
  ) {
    return this.stay.checkOut(user, id, input);
  }

  @Post(':id/confirm-property-collection')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmPropertyCollection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: ConfirmPropertyCollectionDto,
  ) {
    return this.stay.confirmPropertyCollection(user, id, input);
  }

  @Post(':id/confirm-handover')
  confirmHandover(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: CheckOutOwnerStayDto,
  ) {
    return this.stay.confirmHandover(user, id, input);
  }

  @Get(':id/check-out-preview')
  previewCheckOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.stay.previewCheckOut(user, id);
  }

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
