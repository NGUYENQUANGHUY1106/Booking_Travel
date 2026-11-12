import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RoomPricingRuleKind } from '@prisma/client';

export class PricingMonthDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;
}

export class PricingRangeDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkIn!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  checkOut!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  roomCount?: number;
}

export class PricingRuleDto {
  @IsOptional()
  @IsString()
  ruleId?: string;

  @IsEnum(RoomPricingRuleKind)
  kind!: RoomPricingRuleKind;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDateExclusive!: string;

  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/)
  price!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class BasePriceDto {
  @Matches(/^\d{1,12}(?:\.\d{1,2})?$/)
  price!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class DeletePricingRuleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
