import { Type } from 'class-transformer';
import {
  IsIn,
  IsDateString,
  IsEmail,
  IsInt,
  Max,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsOptional()
  @IsIn(['PAY_AT_HOTEL', 'SIMULATOR'])
  paymentMethod?: 'PAY_AT_HOTEL' | 'SIMULATOR';

  @IsString()
  @Length(20, 5000)
  quoteId!: string;

  @IsString()
  @Length(1, 120)
  roomId!: string;

  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  adults!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  children?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  roomCount?: number;

  @IsString()
  @Length(2, 120)
  guestName!: string;

  @IsEmail()
  guestEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
