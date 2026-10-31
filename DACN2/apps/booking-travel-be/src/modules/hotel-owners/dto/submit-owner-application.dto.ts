import { IsInt, IsOptional, Min } from 'class-validator';

export class SubmitOwnerApplicationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
}
