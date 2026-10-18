import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { RoomStatus } from '@prisma/client';

export class CreateRoomDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(2, 80)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacityAdults!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacityChildren?: number;

  @IsString()
  @Length(2, 120)
  bedInfo!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}
