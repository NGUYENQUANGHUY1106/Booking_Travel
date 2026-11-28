import { ContentReportReason } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateContentReportDto {
  @IsIn(['REVIEW', 'PUBLIC_CHAT'])
  targetType!: 'REVIEW' | 'PUBLIC_CHAT';

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  targetId!: string;

  @IsEnum(ContentReportReason)
  reason!: ContentReportReason;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(1000)
  description!: string;
}
