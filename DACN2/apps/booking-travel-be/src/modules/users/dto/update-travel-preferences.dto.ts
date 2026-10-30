import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AccommodationPreferenceType,
  TravelAmenityPreference,
  TravelAreaPreference,
  TravelTripType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

const MAX_BUDGET_VND = 1_000_000_000;

export class UpdateTravelPreferencesDto {
  @ApiPropertyOptional({ example: 500000, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt({ message: 'Ngân sách tối thiểu phải là số nguyên.' })
  @Min(0)
  @Max(MAX_BUDGET_VND)
  budgetMin?: number | null;

  @ApiPropertyOptional({ example: 3000000, nullable: true })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @Type(() => Number)
  @IsInt({ message: 'Ngân sách tối đa phải là số nguyên.' })
  @Min(0)
  @Max(MAX_BUDGET_VND)
  budgetMax?: number | null;

  @ApiPropertyOptional({ enum: ['VND'], default: 'VND' })
  @IsOptional()
  @IsIn(['VND'], { message: 'Đơn vị ngân sách hiện chỉ hỗ trợ VND.' })
  currency?: 'VND';

  @ApiPropertyOptional({ enum: AccommodationPreferenceType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsEnum(AccommodationPreferenceType, { each: true })
  accommodationTypes?: AccommodationPreferenceType[];

  @ApiPropertyOptional({ enum: TravelTripType, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsEnum(TravelTripType, { each: true })
  tripTypes?: TravelTripType[];

  @ApiPropertyOptional({ enum: TravelAmenityPreference, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsEnum(TravelAmenityPreference, { each: true })
  preferredAmenities?: TravelAmenityPreference[];

  @ApiPropertyOptional({ enum: TravelAreaPreference, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsEnum(TravelAreaPreference, { each: true })
  preferredAreas?: TravelAreaPreference[];
}
