import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayUnique,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RoomStatus } from '@prisma/client';
import { ROOM_BED_TYPES, ROOM_CLASSES, ROOM_VIEWS } from '../room-catalog';

export class BedConfigurationDto {
  @IsIn(ROOM_BED_TYPES.map((item) => item.code))
  bedType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

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

  @IsOptional()
  @IsIn(ROOM_CLASSES.map((item) => item.code))
  classCode?: string;

  @IsOptional()
  @IsIn(ROOM_VIEWS.map((item) => item.code))
  viewCode?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BedConfigurationDto)
  bedConfigurations?: BedConfigurationDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(9999)
  areaM2?: number;

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
  @ArrayUnique()
  @IsString({ each: true })
  amenities?: string[];
}
