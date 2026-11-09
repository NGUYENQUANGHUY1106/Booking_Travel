import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminDashboardService } from './admin-dashboard.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [
    AdminController,
    AdminUsersController,
    AdminDashboardController,
  ],
  providers: [AdminService, AdminUsersService, AdminDashboardService],
})
export class AdminModule {}
