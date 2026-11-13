import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SimulatorSignature } from './simulator-signature';
import { PaymentExpiryService } from './payment-expiry.service';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SimulatorSignature, PaymentExpiryService],
})
export class PaymentsModule {}
