import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('Admin dashboard')
@Controller('admin/dashboard')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminDashboardController {
  constructor(private readonly dashboard: AdminDashboardService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Số booking mới và hoạt động kiểm duyệt gần đây cho Admin Dashboard',
  })
  summary() {
    return this.dashboard.summary();
  }
}
