import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OwnerDocumentPurpose, UserRole } from '@prisma/client';
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UpdateOwnerApplicationDto } from './dto/update-owner-application.dto';
import { AdminOwnerApplicationQueryDto } from './dto/admin-owner-application-query.dto';
import { OwnerDecisionDto } from './dto/owner-decision.dto';
import { SubmitOwnerApplicationDto } from './dto/submit-owner-application.dto';
import { OwnerApplicationsService } from './owner-applications.service';
import { OwnerVerificationService } from './owner-verification.service';

@ApiTags('Owner applications')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER)
@Controller('owner-applications')
export class OwnerApplicationsController {
  constructor(
    private readonly applications: OwnerApplicationsService,
    private readonly verification: OwnerVerificationService,
  ) {}

  @Get('me')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  current(@CurrentUserId() userId: string) {
    return this.applications.current(userId);
  }

  @Get('me/notifications')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  notifications(@CurrentUserId() userId: string) {
    return this.verification.notifications(userId);
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
  submit(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() input: SubmitOwnerApplicationDto,
  ) {
    return this.applications.submit(userId, id, input);
  }
}

@ApiTags('Admin owner application queue')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('HOTEL_REVIEW')
@Controller('admin/owner-applications')
export class AdminOwnerApplicationsController {
  constructor(
    private readonly applications: OwnerApplicationsService,
    private readonly verification: OwnerVerificationService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  list(
    @Query() query: AdminOwnerApplicationQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.verification.list(query, actor);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  detail(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.verification.detail(id, actor);
  }

  @Get(':id/documents/:purpose/access')
  @Header('Cache-Control', 'no-store')
  documentAccess(
    @Param('id') id: string,
    @Param('purpose') purpose: OwnerDocumentPurpose,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    if (
      purpose !== OwnerDocumentPurpose.IDENTITY &&
      purpose !== OwnerDocumentPurpose.BUSINESS_LICENSE
    ) {
      throw new BadRequestException('Loại tài liệu không hợp lệ.');
    }
    return this.applications.adminDocumentAccess(id, purpose, actor);
  }

  @Post(':id/decision')
  @Header('Cache-Control', 'no-store')
  decide(
    @Param('id') id: string,
    @Body() input: OwnerDecisionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.verification.decide(id, input, actor);
  }
}
