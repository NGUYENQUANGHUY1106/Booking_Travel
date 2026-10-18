import { BookingStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class BookingQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  hotelId?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;
}
