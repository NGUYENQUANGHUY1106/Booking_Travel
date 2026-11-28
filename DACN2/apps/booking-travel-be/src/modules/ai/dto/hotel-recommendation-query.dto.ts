import { PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { HotelQueryDto } from '../../hotels/dto/hotel-query.dto';

export class HotelRecommendationQueryDto extends PickType(HotelQueryDto, [
  'search',
  'checkIn',
  'checkOut',
  'rooms',
  'adults',
  'children',
] as const) {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  limit?: number;
}
