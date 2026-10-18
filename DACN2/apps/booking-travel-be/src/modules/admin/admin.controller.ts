import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@ApiTags('Admins')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('USER_MANAGEMENT')
@Controller('admins')
export class AdminController {
  constructor(private readonly admins: AdminService) {}

  @Get()
  list() {
    return this.admins.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.admins.get(id);
  }

  @Post()
  create(
    @Body() input: CreateAdminDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admins.create(input, user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateAdminDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.admins.update(id, input, user);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admins.remove(id, user);
  }
}
