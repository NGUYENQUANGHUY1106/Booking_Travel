import { HotelReportStatus, ReportTargetType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ReportQueueDto {
  @IsOptional() @IsEnum(HotelReportStatus) status?: HotelReportStatus;
  @IsOptional() @IsEnum(ReportTargetType) targetType?: ReportTargetType;
  @IsOptional() @IsString() @MaxLength(80) search?: string;
  @IsOptional() @IsString() @MaxLength(80) reason?: string;
  @IsOptional() @IsString() @MaxLength(100) assigneeId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
}

export class ReportDecisionDto {
  @IsIn(['HIDE', 'DISMISS', 'ALREADY_HANDLED', 'HIDE_HOTEL', 'SUSPEND_HOTEL'])
  action!:
    'HIDE' | 'DISMISS' | 'ALREADY_HANDLED' | 'HIDE_HOTEL' | 'SUSPEND_HOTEL';
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
  @IsString() @MinLength(8) @MaxLength(80) requestId!: string;
}

export class RestoreContentDto {
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
  @IsString() @MinLength(8) @MaxLength(80) requestId!: string;
}
