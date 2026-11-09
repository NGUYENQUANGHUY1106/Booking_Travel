import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class HotelReviewQueryDto {
  @IsOptional()
  @IsIn(['PENDING'])
  status?: 'PENDING';

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @Matches(
    /^(HOTEL|RESORT|APARTMENT|VILLA|HOMESTAY|HOSTEL)(,(HOTEL|RESORT|APARTMENT|VILLA|HOMESTAY|HOSTEL))*$/,
  )
  types?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @IsOptional()
  @IsIn(['newest', 'oldest'])
  sort: 'newest' | 'oldest' = 'newest';
}
