import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OwnedResource } from '../../common/decorators/owned-resource.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { OwnershipGuard } from '../../common/guards/ownership.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { BookingQueryDto } from './dto/booking-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { QuoteBookingDto } from './dto/quote-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { BookingsService } from './bookings.service';
import { BookingInvoicesService } from './booking-invoices.service';
import { BookingConfirmationsService } from './booking-confirmations.service';

@ApiTags('Bookings')
@UseGuards(AccessTokenGuard, RolesGuard, OwnershipGuard)
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly invoices: BookingInvoicesService,
    private readonly confirmations: BookingConfirmationsService,
  ) {}

  @Get()
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER, UserRole.ADMIN)
  list(
    @Query() query: BookingQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.list(query, user);
  }

  @Get(':id/confirmation')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'booking', param: 'id', action: 'read' })
  confirmation(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.confirmations.get(id, user);
  }

  @Get(':id/invoice')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'booking', param: 'id', action: 'read' })
  invoice(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.getOrCreate(id, user);
  }

  @Get(':id/invoice/document')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'booking', param: 'id', action: 'read' })
  async invoiceDocument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const invoice = await this.invoices.getOrCreate(id, user);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${invoice.fileName}"`,
    );
    response.send(invoice.documentHtml);
  }

  @Get(':id/invoice/pdf')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  @OwnedResource({ resource: 'booking', param: 'id', action: 'read' })
  async invoicePdf(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const pdf = await this.invoices.getPdf(id, user);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdf.fileName}"`,
    );
    response.send(pdf.content);
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
    return this.bookings.create(user, input);
  }

  @Post('quote')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  quote(
    @Body() input: QuoteBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.quote(input, user);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @OwnedResource({ resource: 'booking', param: 'id', action: 'manage' })
  updateStatus(
    @Param('id') id: string,
    @Body() input: UpdateBookingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookings.updateStatus(id, user, input);
  }
}
