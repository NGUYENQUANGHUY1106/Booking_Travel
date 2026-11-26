import {
  Equals,
  IsIn,
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

  @IsOptional()
  @Equals(true)
  confirmedCollection?: true;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  collectedAmount?: string;

  @IsOptional()
  @IsIn(['CASH', 'BANK_TRANSFER'])
  collectionMethod?: 'CASH' | 'BANK_TRANSFER';
}

export class ConfirmPropertyCollectionDto {
  @Equals(true)
  confirmedCollection!: true;

  @IsString()
  @Matches(/^\d+(?:\.\d{1,2})?$/)
  collectedAmount!: string;

  @IsIn(['CASH', 'BANK_TRANSFER'])
  collectionMethod!: 'CASH' | 'BANK_TRANSFER';

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,120}$/)
  idempotencyKey!: string;
}

export class CheckOutOwnerStayDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,120}$/)
  idempotencyKey!: string;

  @Equals(true)
  confirmed!: true;
}
