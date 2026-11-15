import { OmitType } from '@nestjs/swagger';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { HotelStaySearchQueryDto } from './hotel-stay-search-query.dto';

export class NearbyHotelSearchQueryDto extends OmitType(
  HotelStaySearchQueryDto,
  ['destination'] as const,
) {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  landmark?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(50)
  radiusKm!: number;

  @IsOptional()
  @IsIn(['distance', 'recommended'])
  nearbySort?: 'distance' | 'recommended';
}
