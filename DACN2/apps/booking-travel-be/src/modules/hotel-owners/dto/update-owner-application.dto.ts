import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateOwnerApplicationDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  representativeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  businessRegistrationNumber?: string;

  @ValidateIf(
    (_, value: unknown) =>
      value !== undefined && value !== null && value !== '',
  )
  @IsString()
  @MaxLength(30)
  @Matches(/^\+?[0-9][0-9\s-]{7,20}$/, {
    message: 'Số điện thoại cơ sở không hợp lệ.',
  })
  businessPhone?: string;

  @IsOptional()
  @IsString()
  identityDocumentId?: string | null;

  @IsOptional()
  @IsString()
  businessLicenseDocumentId?: string | null;
}
