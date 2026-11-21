import {
  Equals,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class VerifyOwnerStayDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  qrToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  bookingCode?: string;
}

export class CheckInOwnerStayDto extends VerifyOwnerStayDto {
  @IsString()
  @MinLength(20)
  @MaxLength(1000)
  verificationRef!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,120}$/)
  idempotencyKey!: string;

  @Equals(true)
  confirmed!: true;
}

export class CheckOutOwnerStayDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,120}$/)
  idempotencyKey!: string;

  @Equals(true)
  confirmed!: true;
}
