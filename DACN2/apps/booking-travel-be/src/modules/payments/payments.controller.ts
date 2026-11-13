import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PaymentsService } from './payments.service';
import { SimulatorSignature } from './simulator-signature';

@ApiTags('Payments')
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
  status(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.status(id, user);
  }

  @Post(':provider/webhook')
  webhook(
    @Param('provider') provider: string,
    @Req() request: RawBodyRequest<Request>,
  ) {
    if (provider !== this.simulator.provider)
      throw new BadRequestException('Cổng thanh toán không được hỗ trợ.');
    const timestamp = request.header('x-bt-simulator-timestamp') ?? undefined;
    const signature = request.header('x-bt-simulator-signature') ?? undefined;
    const verified = this.simulator.verify(
      request.rawBody,
      timestamp,
      signature,
    );
    return this.payments.webhook(verified.event, verified.payloadHash);
  }
}
