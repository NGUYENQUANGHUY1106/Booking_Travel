import { Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @Length(1, 120)
  roomId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
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

  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[0-9][0-9 .-]{7,19}$/)
  guestPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
