import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import {
  OwnerPricingController,
  PublicPricingController,
} from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuthModule],
  controllers: [OwnerPricingController, PublicPricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
