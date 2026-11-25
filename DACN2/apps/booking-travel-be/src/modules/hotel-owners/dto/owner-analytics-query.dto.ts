import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OwnerDashboardQueryDto } from './owner-dashboard-query.dto';

export class OwnerAnalyticsQueryDto extends OwnerDashboardQueryDto {
  @ApiPropertyOptional({ enum: ['DAY', 'WEEK', 'MONTH', 'YEAR'] })
  @IsOptional()
  @IsIn(['DAY', 'WEEK', 'MONTH', 'YEAR'])
  granularity: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' = 'DAY';

  @ApiPropertyOptional({ description: 'Room ID within the selected hotel.' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  roomId?: string;
}
