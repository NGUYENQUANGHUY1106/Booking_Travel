import { ApiPropertyOptional } from '@nestjs/swagger';
import { OwnerApplicationStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const REVIEW_STATUSES = [
  OwnerApplicationStatus.PENDING,
  OwnerApplicationStatus.VERIFIED,
  OwnerApplicationStatus.REJECTED,
  OwnerApplicationStatus.SUSPENDED,
] as const;

export class AdminOwnerApplicationQueryDto {
  @ApiPropertyOptional({
    description: 'Tên, liên hệ, doanh nghiệp hoặc mã hồ sơ',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: REVIEW_STATUSES })
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: OwnerApplicationStatus;

  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, maximum: 50 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 10;

  @ApiPropertyOptional({
    enum: ['submittedAt', 'updatedAt'],
    default: 'submittedAt',
  })
  @IsOptional()
  @IsIn(['submittedAt', 'updatedAt'])
  sortBy: 'submittedAt' | 'updatedAt' = 'submittedAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}
