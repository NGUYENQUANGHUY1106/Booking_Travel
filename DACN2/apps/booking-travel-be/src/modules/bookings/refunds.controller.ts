import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { RefundRequestStatus, UserRole } from '@prisma/client';
import { IsIn, IsString, Length } from 'class-validator';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { RefundsService } from './refunds.service';
import { RefundSimulatorSignature } from './refund-simulator-signature';

class CancelBookingDto {
  @IsString()
  @Length(2, 500)
  reason!: string;
}

class RefundDecisionDto {
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';

  @IsString()
  @Length(2, 500)
  reason!: string;
}

class RefundReopenDto {
  @IsString()
  @Length(2, 500)
  reason!: string;
}

@ApiTags('Booking refunds')
@Controller('bookings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.HOTEL_OWNER)
export class BookingCancellationController {
  constructor(private readonly refunds: RefundsService) {}

  @Get(':id/cancellation-preview')
  preview(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.refunds.preview(id, user);
  }

  @Post(':id/cancel')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CancelBookingDto,
  ) {
    return this.refunds.cancel(id, user, input.reason);
  }
}

@ApiTags('Refund requests')
@Controller('refunds')
export class RefundsController {
  constructor(
    private readonly refunds: RefundsService,
    private readonly signature: RefundSimulatorSignature,
  ) {}

  @Get()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.refunds.listForUser(user);
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.refunds.getForUser(id, user);
  }

  @Post('simulator/webhook')
  webhook(@Req() request: RawBodyRequest<Request>) {
    const verified = this.signature.verify(
      request.rawBody,
      request.header('x-bt-simulator-timestamp') ?? undefined,
      request.header('x-bt-refund-signature') ?? undefined,
    );
    return this.refunds.simulatorWebhook(verified.event, verified.payloadHash);
  }
}

@ApiTags('Admin refunds')
@Controller('admin/refunds')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('BOOKING_SUPPORT')
export class AdminRefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    if (
      status &&
      !Object.values(RefundRequestStatus).includes(
        status as RefundRequestStatus,
      )
    )
      throw new BadRequestException('Trạng thái hoàn tiền không hợp lệ.');
    return this.refunds.listForAdmin(
      user,
      status as RefundRequestStatus | undefined,
      search,
    );
  }

  @Get('payments')
  payments(@CurrentUser() user: AuthenticatedUser) {
    return this.refunds.listPaymentsForAdmin(user);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.refunds.getForAdmin(id, user);
  }

  @Post(':id/decision')
  decide(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: RefundDecisionDto,
  ) {
    return this.refunds.decide(id, user, input.decision, input.reason);
  }

  @Post(':id/dispatch')
  dispatch(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.refunds.dispatch(id, user);
  }

  @Post(':id/reopen')
  reopen(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: RefundReopenDto,
  ) {
    return this.refunds.reopenFailed(id, user, input.reason);
  }
}
