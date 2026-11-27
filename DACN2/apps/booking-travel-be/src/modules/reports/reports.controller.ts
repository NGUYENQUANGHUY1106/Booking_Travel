import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ReportTargetType, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateHotelReportDto } from './dto/create-hotel-report.dto';
import { ReportsService } from './reports.service';
import { ReportModerationService } from './report-moderation.service';
import {
  ReportDecisionDto,
  ReportQueueDto,
  RestoreContentDto,
} from './dto/admin-report.dto';

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
  constructor(
    private readonly reports: ReportsService,
    private readonly moderation: ReportModerationService,
  ) {}

  @Get('queue')
  queue(@Query() query: ReportQueueDto) {
    return this.moderation.list(query);
  }

  @Get('queue/:kind/:id')
  queueDetail(
    @Param('kind', new ParseEnumPipe(ReportTargetType)) kind: ReportTargetType,
    @Param('id') id: string,
  ) {
    return this.moderation.detail(kind, id);
  }

  @Post('queue/:kind/:id/claim')
  claim(
    @Param('kind', new ParseEnumPipe(ReportTargetType)) kind: ReportTargetType,
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.moderation.claim(kind, id, actor.id);
  }

  @Post('queue/:kind/:id/decision')
  decision(
    @Param('kind', new ParseEnumPipe(ReportTargetType)) kind: ReportTargetType,
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: ReportDecisionDto,
  ) {
    return this.moderation.decide(kind, id, actor, input);
  }

  @Post('restore/:kind/:id')
  restore(
    @Param('kind', new ParseEnumPipe(ReportTargetType)) kind: ReportTargetType,
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() input: RestoreContentDto,
  ) {
    if (kind !== 'REVIEW' && kind !== 'REPLY')
      throw new BadRequestException('Chỉ khôi phục đánh giá hoặc phản hồi.');
    return this.moderation.restore(kind, id, actor.id, input);
  }

  @Get()
  list() {
    return this.reports.listForAdmin();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.reports.getForAdmin(id);
  }
}
