import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AdminUsersService } from './admin-users.service';
import { AccountActionDto } from './dto/account-action.dto';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

@ApiTags('Admin Users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('USER_MANAGEMENT')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'ST-ADM-02: tìm và phân trang tài khoản' })
  list(
    @Query() query: AdminUserQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.list(query, actor);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ST-ADM-02: hồ sơ, hoạt động và audit tài khoản' })
  get(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.users.get(id, actor);
  }

  @Patch(':id/lock')
  lock(
    @Param('id') id: string,
    @Body() input: AccountActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.changeStatus(id, 'LOCK', input.reason, actor);
  }

  @Patch(':id/unlock')
  unlock(
    @Param('id') id: string,
    @Body() input: AccountActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.changeStatus(id, 'UNLOCK', input.reason, actor);
  }

  @Patch(':id/suspend')
  suspend(
    @Param('id') id: string,
    @Body() input: AccountActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.changeStatus(id, 'SUSPEND', input.reason, actor);
  }

  @Patch(':id/restore')
  restore(
    @Param('id') id: string,
    @Body() input: AccountActionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.users.changeStatus(id, 'RESTORE', input.reason, actor);
  }
}
