import { AccommodationPreferenceType, HotelStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminHotelListDto {
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() @MaxLength(120) ownerId?: string;
  @IsOptional() @IsEnum(HotelStatus) status?: HotelStatus;
  @IsOptional() @IsIn(['ALL', 'VISIBLE', 'HIDDEN']) visibility?:
    'ALL' | 'VISIBLE' | 'HIDDEN';
  @IsOptional()
  @IsEnum(AccommodationPreferenceType)
  type?: AccommodationPreferenceType;
  @IsOptional() @IsString() @MaxLength(100) province?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
}

export class AdminHotelDecisionDto {
  @IsIn(['HIDE', 'SUSPEND', 'RESTORE']) action!: 'HIDE' | 'SUSPEND' | 'RESTORE';
  @IsString() @MinLength(10) @MaxLength(1000) reason!: string;
  @IsOptional() @IsString() @MaxLength(500) evidenceReference?: string;
  @IsInt() @Min(0) expectedRestrictionVersion!: number;
  @IsInt() @Min(1) expectedProfileVersion!: number;
  @IsString() @MinLength(8) @MaxLength(80) requestId!: string;
}
