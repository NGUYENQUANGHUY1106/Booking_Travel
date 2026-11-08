import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  Matches,
  ValidateIf,
} from 'class-validator';

export class ReviewHotelSubmissionDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @IsInt() @Min(1) expectedVersion!: number;
  @ValidateIf((value: ReviewHotelSubmissionDto) => value.decision === 'REJECT')
  @IsString()
  @Length(3, 1000)
  reason?: string;

  @IsOptional()
  @IsString()
  @Length(12, 80)
  @Matches(/^[a-zA-Z0-9-]+$/)
  requestId?: string;
}
