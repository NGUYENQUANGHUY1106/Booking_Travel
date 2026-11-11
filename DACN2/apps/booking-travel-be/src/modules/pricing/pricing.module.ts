import { Module } from '@nestjs/common';
import {
  OwnerPricingController,
  PublicPricingController,
} from './pricing.controller';
import { PricingService } from './pricing.service';

@Module({
  controllers: [OwnerPricingController, PublicPricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
