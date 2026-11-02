import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import {
  HOTEL_IMAGE_MAX_BYTES,
  HOTEL_IMAGE_TYPES,
} from '../hotel-media.service';

export class UpdateHotelLocationDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsOptional() @IsString() @Length(2, 200) addressLine?: string | null;
  @IsOptional() @IsString() provinceUnitId?: string | null;
  @IsOptional() @IsString() districtUnitId?: string | null;
  @IsOptional() @IsString() wardUnitId?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(7) @Max(24.5) latitude?:
    number | null;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(102)
  @Max(117.5)
  longitude?: number | null;
}

export class UpdateHotelAmenitiesDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsArray() @ArrayUnique() @IsString({ each: true }) amenityIds!: string[];
}

export class PresignHotelImageDto {
  @IsIn(HOTEL_IMAGE_TYPES) mimeType!: string;
  @IsInt() @Min(8) @Max(HOTEL_IMAGE_MAX_BYTES) sizeBytes!: number;
}

export class FinalizeHotelImageDto {
  @IsString() mediaId!: string;
}

export class CoverHotelImageDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsString() mediaId!: string;
}

export class HotelVersionDto {
  @IsInt() @Min(1) expectedVersion!: number;
}

export class ReorderHotelImagesDto {
  @IsInt() @Min(1) expectedVersion!: number;
  @IsArray() @ArrayUnique() @IsString({ each: true }) mediaIds!: string[];
}

export class SubmitHotelDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
