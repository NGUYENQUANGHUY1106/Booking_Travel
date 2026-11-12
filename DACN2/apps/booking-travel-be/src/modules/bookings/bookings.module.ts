import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [AuthorizationModule, PricingModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
