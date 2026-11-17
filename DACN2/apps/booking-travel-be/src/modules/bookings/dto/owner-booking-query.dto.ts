import { BookingStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum OwnerBookingTab {
  ALL = 'all',
  NEW = 'new',
  UPCOMING = 'upcoming',
  CHECKED_IN = 'checked-in',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export class OwnerBookingQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hotelId?: string;

  @IsOptional()
  @IsEnum(OwnerBookingTab)
  tab?: OwnerBookingTab;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkInFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkInTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
