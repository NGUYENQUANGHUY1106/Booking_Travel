import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class InventoryMonthDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month!: string;
}

export class CreateInventoryBlockDto {
  @Matches(DATE_PATTERN)
  startDate!: string;

  @Matches(DATE_PATTERN)
  endDateExclusive!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsUUID()
  idempotencyKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}

export class UpdateInventoryBlockDto extends CreateInventoryBlockDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class ReleaseInventoryBlockDto {
  @IsUUID()
  idempotencyKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class SetInventoryOverrideDto {
  @Matches(DATE_PATTERN)
  startDate!: string;

  @Matches(DATE_PATTERN)
  endDateExclusive!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sellableQty!: number | null;

  @IsUUID()
  idempotencyKey!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedRevision!: number;
}
