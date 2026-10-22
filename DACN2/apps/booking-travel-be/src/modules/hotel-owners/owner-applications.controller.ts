import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OwnerDocumentPurpose, UserRole } from '@prisma/client';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateOwnerApplicationDto } from './dto/update-owner-application.dto';
import { OwnerApplicationsService } from './owner-applications.service';

@ApiTags('Owner applications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER)
@Controller('owner-applications')
export class OwnerApplicationsController {
  constructor(private readonly applications: OwnerApplicationsService) {}

  @Get('me')
  current(@CurrentUserId() userId: string) {
    return this.applications.current(userId);
  }

  @Post()
  create(@CurrentUserId() userId: string) {
    return this.applications.createDraft(userId);
  }

  @Patch(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() input: UpdateOwnerApplicationDto,
  ) {
    return this.applications.updateDraft(userId, id, input);
  }

  @Post(':id/submit')
  submit(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.applications.submit(userId, id);
  }
}

@ApiTags('Admin owner application queue')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('HOTEL_REVIEW')
@Controller('admin/owner-applications')
export class AdminOwnerApplicationsController {
  constructor(private readonly applications: OwnerApplicationsService) {}

  @Get()
  list() {
    return this.applications.listPending();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.applications.adminDetail(id);
  }

  @Get(':id/documents/:purpose/access')
  documentAccess(
    @Param('id') id: string,
    @Param('purpose') purpose: OwnerDocumentPurpose,
  ) {
    if (
      purpose !== OwnerDocumentPurpose.IDENTITY &&
      purpose !== OwnerDocumentPurpose.BUSINESS_LICENSE
    ) {
      throw new BadRequestException('Loại tài liệu không hợp lệ.');
    }
    return this.applications.adminDocumentAccess(id, purpose);
  }
}
