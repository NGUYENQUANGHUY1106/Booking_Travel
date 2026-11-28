import { Transform } from 'class-transformer';
import { OmitType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const REVIEW_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const REVIEW_IMAGE_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;
export const REVIEW_IMAGE_ID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.(jpg|png|webp)$/;

export class CreateReviewDto {
  @IsInt()
  @Min(1)
  @Max(10)
  rating!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  cleanliness!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  location!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  service!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  facilities!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  comfort!: number;

  @IsInt()
  @Min(1)
  @Max(10)
  value!: number;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  comment!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @Matches(REVIEW_IMAGE_ID, { each: true })
  imageIds?: string[];
}

export class UpdateReviewDto extends OmitType(CreateReviewDto, [
  'imageIds',
] as const) {}

export class ReviewImageUploadDto {
  @IsIn(Object.keys(REVIEW_IMAGE_TYPES))
  extension!: keyof typeof REVIEW_IMAGE_TYPES;

  @IsInt()
  @Min(8)
  @Max(REVIEW_IMAGE_MAX_BYTES)
  sizeBytes!: number;
}

export class ModerateReviewDto {
  @IsIn(['HIDE', 'DELETE', 'RESTORE'])
  action!: 'HIDE' | 'DELETE' | 'RESTORE';

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}
