import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AccommodationPreferenceType } from '@prisma/client';

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
  @IsEnum(AccommodationPreferenceType)
  accommodationType?: AccommodationPreferenceType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hotelDescription?: string;

  @IsOptional()
  @IsString()
  @Matches(
    /^(?:https?:\/\/[^\s]+|\/api\/owner-covers\/[0-9a-f-]{36}\/content)$/i,
    { message: 'Đường dẫn ảnh bìa không hợp lệ.' },
  )
  @MaxLength(2048)
  hotelCoverImageUrl?: string;

  @IsOptional()
  @IsString()
  identityDocumentId?: string | null;

  @IsOptional()
  @IsString()
  businessLicenseDocumentId?: string | null;
}
