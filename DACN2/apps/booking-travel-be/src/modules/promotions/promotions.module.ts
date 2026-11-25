import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { AdminVouchersController } from './admin-vouchers.controller';
import { AdminOwnerPromotionsController } from './admin-owner-promotions.controller';
import { PlatformVouchersService } from './platform-vouchers.service';
import { OwnerPromotionsController } from './owner-promotions.controller';
import { OwnerPromotionsService } from './owner-promotions.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [AuthorizationModule, PricingModule],
  controllers: [
    AdminVouchersController,
    AdminOwnerPromotionsController,
    OwnerPromotionsController,
  ],
  providers: [PlatformVouchersService, OwnerPromotionsService],
  exports: [PlatformVouchersService, OwnerPromotionsService],
})
export class PromotionsModule {}
