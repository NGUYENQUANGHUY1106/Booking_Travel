import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class ReviewHotelSubmissionDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @IsInt() @Min(1) expectedVersion!: number;
  @ValidateIf((value: ReviewHotelSubmissionDto) => value.decision === 'REJECT')
  @IsString()
  @Length(3, 1000)
  reason?: string;
}
