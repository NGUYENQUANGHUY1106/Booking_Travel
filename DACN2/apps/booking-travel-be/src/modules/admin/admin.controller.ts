import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@ApiTags('Admins')
@Controller('admins')
export class AdminController {
  constructor(private readonly admins: AdminService) {}

  // ST-AUTH-08: các endpoint này chưa gắn guard/RBAC theo phạm vi hiện tại.
  @Get()
  list() {
    return this.admins.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.admins.get(id);
  }

  @Post()
  create(@Body() input: CreateAdminDto) {
    return this.admins.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateAdminDto) {
    return this.admins.update(id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.admins.remove(id);
  }
}
