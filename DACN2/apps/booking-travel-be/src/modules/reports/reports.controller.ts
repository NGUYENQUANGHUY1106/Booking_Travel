import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateHotelReportDto } from './dto/create-hotel-report.dto';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Hotel reports')
@ApiBearerAuth()
@Controller('hotel-reports')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.HOTEL_OWNER)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateHotelReportDto,
  ) {
    return this.reports.create(user, input);
  }
}

@ApiTags('Admin hotel reports')
@ApiBearerAuth()
@Controller('admin/hotel-reports')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list() {
    return this.reports.listForAdmin();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.reports.getForAdmin(id);
  }
}

@ApiTags('Content reports')
@ApiBearerAuth()
@Controller('content-reports')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.USER, UserRole.HOTEL_OWNER)
export class ContentReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() input: CreateContentReportDto,
  ) {
    return this.reports.createContentReport(user.id, input);
  }
}

@ApiTags('Admin content reports')
@ApiBearerAuth()
@Controller('admin/content-reports')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Permissions('HOTEL_REVIEW')
export class AdminContentReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(@Query('cursor') cursor?: string) {
    return this.reports.listReviewReports(cursor);
  }
}
