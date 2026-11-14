import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
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
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.HOTEL_OWNER)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initialize')
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
      {
        type: 'custom',
        data: 'Idempotency-Key',
      },
    );
    return this.payments.initialize(user.id, key, input);
  }

  @Get('booking/:bookingId')
  getByBooking(
    @Param('bookingId') bookingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.getByBooking(bookingId, user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.get(id, user.id);
  }
}
