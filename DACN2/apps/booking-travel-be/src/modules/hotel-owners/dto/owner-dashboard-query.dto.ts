import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class OwnerDashboardQueryDto {
  @ApiPropertyOptional({
    description: 'Omit for all hotels owned by the authenticated Owner.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  hotelId?: string;

  @ApiProperty({
    example: '2026-11-01',
    description: 'Inclusive calendar date.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom!: string;

  @ApiProperty({
    example: '2026-11-01',
    description: 'Inclusive calendar date.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo!: string;

  @ApiProperty({
    enum: ['Asia/Ho_Chi_Minh'],
    description:
      'Confirmed reporting timezone; createdAt boundaries use Vietnam time and stay dates remain calendar dates.',
  })
  @IsIn(['Asia/Ho_Chi_Minh'])
  @IsString()
  @MaxLength(80)
  timeZone!: string;
}

export class OwnerDashboardHotelsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  after?: string;

  @ApiPropertyOptional({ default: 30, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 30;
}
