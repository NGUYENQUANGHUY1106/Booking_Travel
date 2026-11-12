import { Type } from 'class-transformer';
import {
  IsInt,
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
  @Type(() => Number) @IsInt() @Min(1) adults!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) children?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) roomCount?: number;
}
