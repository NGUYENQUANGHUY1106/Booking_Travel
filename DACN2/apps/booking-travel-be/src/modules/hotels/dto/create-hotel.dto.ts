import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHotelDto {
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsString()
  @Length(2, 180)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;

  @IsString()
  @Length(2, 300)
  addressLine!: string;

  @IsString()
  @Length(2, 100)
  city!: string;

  @IsString()
  @Length(2, 100)
  province!: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  starRating?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;
}
