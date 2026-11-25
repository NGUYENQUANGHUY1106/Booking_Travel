import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PlatformDiscountType } from '@prisma/client';

export class VoucherInputDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(4, 32)
  @Matches(/^[A-Za-z0-9_-]+$/)
  code!: string;
  @IsString() @Length(2, 120) title!: string;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsEnum(PlatformDiscountType) discountType!: PlatformDiscountType;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' || typeof value === 'string'
      ? String(value).trim()
      : value,
  )
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  discountValue!: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' || typeof value === 'string'
      ? String(value).trim()
      : value,
  )
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  maxDiscount?: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' || typeof value === 'string'
      ? String(value).trim()
      : value,
  )
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  minSpend!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'number' || typeof value === 'string'
      ? String(value).trim()
      : value,
  )
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  budget!: string;
  @IsString() @Matches(/^VND$/) currency!: string;
  @IsISO8601() @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) startsAt!: string;
  @IsISO8601() @Matches(/(?:Z|[+-]\d{2}:\d{2})$/) endsAt!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(365) minNights!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) globalLimit!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) perUserLimit!: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  hotelIds?: string[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  eligibleUserIds?: string[];
}

export class VoucherUpdateDto extends VoucherInputDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsString() @Length(5, 500) reason!: string;
}

export class VoucherActionDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsString() @Length(5, 500) reason!: string;
}

export class VoucherListQueryDto {
  @IsOptional() @IsString() @Length(1, 80) search?: string;
  @IsOptional()
  @IsIn([
    'DRAFT',
    'SCHEDULED',
    'ACTIVE',
    'PAUSED',
    'EXPIRED',
    'EXHAUSTED',
    'ENDED',
  ])
  status?: string;
  @IsOptional() @IsIn(['PERCENT', 'FIXED']) discountType?: string;
  @IsOptional() @IsIn(['ALL', 'HOTEL']) scope?: string;
  @IsOptional() @IsIn(['newest', 'oldest']) sort?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class VoucherPreviewDto {
  @IsString() @Length(1, 100) roomId!: string;
  @IsString() @Length(1, 100) userId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkIn!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOut!: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  roomCount?: number;
}
