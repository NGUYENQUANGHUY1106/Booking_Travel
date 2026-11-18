import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PricingModule } from '../pricing/pricing.module';
import { BookingQuoteToken } from './booking-quote-token';
import { BookingInvoicesService } from './booking-invoices.service';
import { OwnerBookingsController } from './owner-bookings.controller';
import { OwnerBookingsService } from './owner-bookings.service';
import { OwnerStayService } from './owner-stay.service';
import { BookingConfirmationsService } from './booking-confirmations.service';
import { BookingQrToken } from './booking-qr-token';
import {
  BookingCancellationController,
  RefundsController,
  AdminRefundsController,
} from './refunds.controller';
import { RefundsService } from './refunds.service';
import { RefundSimulatorSignature } from './refund-simulator-signature';
import { SimulatorSignature } from '../payments/simulator-signature';

@Module({
  imports: [
    AuthorizationModule,
    PricingModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [
    BookingsController,
    OwnerBookingsController,
    BookingCancellationController,
    RefundsController,
    AdminRefundsController,
  ],
  providers: [
    BookingsService,
    BookingQuoteToken,
    BookingInvoicesService,
    BookingConfirmationsService,
    BookingQrToken,
    OwnerBookingsService,
    OwnerStayService,
    RefundsService,
    RefundSimulatorSignature,
    SimulatorSignature,
  ],
})
export class BookingsModule {}
