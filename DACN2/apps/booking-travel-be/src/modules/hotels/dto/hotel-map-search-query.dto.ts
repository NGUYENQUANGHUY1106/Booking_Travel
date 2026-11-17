import { Type } from 'class-transformer';
import { IsNumber, Max, Min } from 'class-validator';
import { HotelStaySearchQueryDto } from './hotel-stay-search-query.dto';

export class HotelMapSearchQueryDto extends HotelStaySearchQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  northEastLatitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  northEastLongitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  southWestLatitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  southWestLongitude!: number;
}
