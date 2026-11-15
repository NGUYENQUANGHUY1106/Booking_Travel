import { Type } from 'class-transformer';
import {
  IsInt,
  Max,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

export class QuoteBookingDto {
  @IsString() @Length(1, 120) roomId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkIn!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOut!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) adults!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(50) children?: number;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  roomCount?: number;
  @IsOptional() @IsString() @Length(1, 80) hotelId?: string;
  @IsOptional() @IsString() @Length(1, 100) voucherCode?: string;
  @IsOptional() @Matches(/^\d+(?:\.\d{1,2})?$/) expectedTotalAmount?: string;
}
