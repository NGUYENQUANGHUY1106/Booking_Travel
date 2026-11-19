import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { AdminVouchersController } from './admin-vouchers.controller';
import { PlatformVouchersService } from './platform-vouchers.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [AdminVouchersController],
  providers: [PlatformVouchersService],
  exports: [PlatformVouchersService],
})
export class PromotionsModule {}
