import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class HotelStaySearchQueryDto {
  @Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  destination!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn!: string;

  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOut!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(40)
  adults!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(40)
  children!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  rooms!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
