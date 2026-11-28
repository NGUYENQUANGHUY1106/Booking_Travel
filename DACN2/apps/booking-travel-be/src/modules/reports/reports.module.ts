import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import {
  AdminReportsController,
  AdminContentReportsController,
  ContentReportsController,
  ReportsController,
} from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    AuthorizationModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
  ],
  controllers: [
    ReportsController,
    AdminReportsController,
    ContentReportsController,
    AdminContentReportsController,
  ],
  providers: [ReportsService],
})
export class ReportsModule {}
