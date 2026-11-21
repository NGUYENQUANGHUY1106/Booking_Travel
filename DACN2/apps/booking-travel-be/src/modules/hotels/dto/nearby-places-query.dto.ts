import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { NEARBY_PLACE_CATEGORIES } from '../nearby-places.types';

export class NearbyPlacesQueryDto {
  @IsOptional()
  @IsIn(NEARBY_PLACE_CATEGORIES)
  category?: (typeof NEARBY_PLACE_CATEGORIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}
