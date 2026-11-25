import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PlatformDiscountType } from '@prisma/client';

export class OwnerPromotionInputDto {
  @IsOptional() @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/) code?: string;
  @IsString() @Length(2, 120) title!: string;
  @IsOptional() @IsString() @Length(0, 500) description?: string;
  @IsEnum(PlatformDiscountType) discountType!: PlatformDiscountType;
  @Matches(/^\d+(?:\.\d{1,2})?$/) discountValue!: string;
  @IsOptional() @Matches(/^\d+(?:\.\d{1,2})?$/) maxDiscount?: string;
  @Matches(/^VND$/) currency!: string;
  @Matches(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
  )
  startsAt!: string;
  @Matches(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/,
  )
  endsAt!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) stayStart!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) stayEnd!: string;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) roomIds!: string[];
  @Type(() => Number) @IsInt() @Min(1) @Max(365) minNights!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000) quota!: number;
}

export class OwnerPromotionUpdateDto extends OwnerPromotionInputDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
}

export class OwnerPromotionPreviewDto extends OwnerPromotionInputDto {
  @IsString() @Length(1, 120) roomId!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkIn!: string;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) checkOut!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(20) roomCount!: number;
}

export class OwnerPromotionActionDto {
  @Type(() => Number) @IsInt() @Min(1) version!: number;
  @IsOptional() @IsString() @Length(5, 500) reason?: string;
}

export class OwnerPromotionListDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(['PERCENT', 'FIXED']) discountType?: string;
  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'EXPIRED'])
  status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
