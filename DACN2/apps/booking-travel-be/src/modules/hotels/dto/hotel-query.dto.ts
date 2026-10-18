import { HotelStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class HotelQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ownerId?: string;

  @IsOptional()
  @IsEnum(HotelStatus)
  status?: HotelStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
