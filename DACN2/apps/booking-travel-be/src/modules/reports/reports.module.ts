import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { HotelsModule } from '../hotels/hotels.module';
import {
  AdminReportsController,
  ReportsController,
} from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportModerationService } from './report-moderation.service';

@Module({
  imports: [
    AuthorizationModule,
    HotelsModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [ReportsController, AdminReportsController],
  providers: [ReportsService, ReportModerationService],
})
export class ReportsModule {}
