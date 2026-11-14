import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PricingModule } from '../pricing/pricing.module';
import { BookingQuoteToken } from './booking-quote-token';

@Module({
  imports: [
    AuthorizationModule,
    PricingModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingQuoteToken],
})
export class BookingsModule {}
