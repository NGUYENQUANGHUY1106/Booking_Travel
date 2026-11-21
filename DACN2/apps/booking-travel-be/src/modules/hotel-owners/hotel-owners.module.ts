import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import {
  AdminOwnerApplicationsController,
  OwnerApplicationsController,
} from './owner-applications.controller';
import { OwnerApplicationsService } from './owner-applications.service';
import { OwnerVerificationService } from './owner-verification.service';
import { OwnerDashboardController } from './owner-dashboard.controller';
import {
  OwnerDashboardService,
  OWNER_DASHBOARD_CLOCK,
} from './owner-dashboard.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuthModule, StorageModule, NotificationsModule],
  controllers: [
    OwnerApplicationsController,
    AdminOwnerApplicationsController,
    OwnerDashboardController,
  ],
  providers: [
    OwnerApplicationsService,
    OwnerVerificationService,
    OwnerDashboardService,
    { provide: OWNER_DASHBOARD_CLOCK, useValue: () => new Date() },
  ],
})
export class HotelOwnersModule {}
