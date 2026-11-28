import { HotelReportReason } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';

export class CreateHotelReportDto {
  @IsString()
  @Length(1, 100)
  bookingId!: string;

  @IsString()
  @Length(1, 100)
  hotelId!: string;

  @IsEnum(HotelReportReason)
  reason!: HotelReportReason;

  @IsString()
  @Length(10, 1000)
  description!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl({}, { each: true })
  evidenceUrls?: string[];
}
