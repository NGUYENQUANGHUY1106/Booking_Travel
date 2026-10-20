import { Module } from '@nestjs/common';
import { OwnershipGuard } from '../guards/ownership.guard';
import { RolesGuard } from '../guards/roles.guard';
import { AuthModule } from '../../modules/auth/auth.module';
import { AuditService } from './audit.service';
import { AuthorizationService } from './authorization.service';

@Module({
  imports: [AuthModule],
  providers: [AuthorizationService, AuditService, RolesGuard, OwnershipGuard],
  exports: [
    AuthModule,
    AuthorizationService,
    AuditService,
    RolesGuard,
    OwnershipGuard,
  ],
})
export class AuthorizationModule {}
