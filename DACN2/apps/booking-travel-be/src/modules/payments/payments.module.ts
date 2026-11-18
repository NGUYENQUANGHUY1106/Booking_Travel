import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { AuthModule } from '../auth/auth.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SimulatorSignature } from './simulator-signature';
import { PaymentExpiryService } from './payment-expiry.service';
import { AdminPaymentsController } from './admin-payments.controller';
import { AdminPaymentsService } from './admin-payments.service';

@Module({
  imports: [AuthModule, AuthorizationModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [
    PaymentsService,
    SimulatorSignature,
    PaymentExpiryService,
    AdminPaymentsService,
  ],
})
export class PaymentsModule {}
