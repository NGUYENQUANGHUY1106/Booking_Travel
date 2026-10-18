import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @Length(1, 120)
  userId!: string;

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
  adults!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
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
