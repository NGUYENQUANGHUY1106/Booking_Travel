import { AccommodationPreferenceType } from '@prisma/client';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export const HOTEL_SEARCH_SORTS = [
  'recommended',
  'priceAsc',
  'priceDesc',
  'rating',
] as const;

export type HotelSearchSort = (typeof HOTEL_SEARCH_SORTS)[number];

function csvStrings({ value }: TransformFnParams): unknown {
  if (value === undefined) return undefined;
  const values = Array.isArray(value) ? value : String(value).split(',');
  return values.map((item) => String(item).trim()).filter(Boolean);
}

function csvNumbers(params: TransformFnParams): unknown {
  const values = csvStrings(params);
  return Array.isArray(values) ? values.map(Number) : values;
}

function queryBoolean({ value }: TransformFnParams): unknown {
  if (value === undefined) return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
}

export class HotelStaySearchQueryDto {
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destination!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOut!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  adults!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40)
  children!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  rooms!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  maxPrice?: number;

  @IsOptional()
  @Transform(csvNumbers)
  @IsArray()
  @ArrayMaxSize(5)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  stars?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  minReviewScore?: number;

  @IsOptional()
  @Transform(csvStrings)
  @IsArray()
  @ArrayMaxSize(6)
  @IsEnum(AccommodationPreferenceType, { each: true })
  propertyTypes?: AccommodationPreferenceType[];

  @IsOptional()
  @Transform(csvStrings)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  amenities?: string[];

  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  freeCancellation?: boolean;

  @IsOptional()
  @IsIn(HOTEL_SEARCH_SORTS)
  sort?: HotelSearchSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
