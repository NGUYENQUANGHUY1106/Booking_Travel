import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentsService } from './payments.service';
import { SimulatorSignature } from './simulator-signature';

@ApiTags('Payments')
@Roles(UserRole.USER, UserRole.HOTEL_OWNER)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly simulator: SimulatorSignature,
  ) {}

  @Get('methods')
  methods() {
    return this.payments.methods();
  }

  @Post('initialize')
  @UseGuards(AccessTokenGuard, RolesGuard)
  async initialize(
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() input: InitializePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Thiếu header Idempotency-Key.');
    }
    const key = await new ParseUUIDPipe({ version: '4' }).transform(
      idempotencyKey,
      { type: 'custom', data: 'Idempotency-Key' },
    );
    return this.payments.initialize(user.id, key, input);
  }

  @Get('booking/:bookingId')
  @UseGuards(AccessTokenGuard, RolesGuard)
  getByBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.getByBooking(bookingId, user.id);
  }

  @Post('bookings/:bookingId/init')
  @UseGuards(AccessTokenGuard)
  init(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.init(bookingId, user);
  }

  @Get('bookings/:bookingId/latest')
  @UseGuards(AccessTokenGuard)
  latest(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.latestForBooking(bookingId, user);
  }

  @Get(':id')
  @UseGuards(AccessTokenGuard)
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.get(id, user);
  }

  @Post(':provider/webhook')
  webhook(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (provider !== this.simulator.provider) {
      throw new BadRequestException('Cổng thanh toán không được hỗ trợ.');
    }
    const timestamp = request.header('x-bt-simulator-timestamp') ?? undefined;
    const signature = request.header('x-bt-simulator-signature') ?? undefined;
    const verified = this.simulator.verify(request.rawBody, timestamp, signature);
    return this.payments.webhook(verified.event, verified.payloadHash);
  }
}
