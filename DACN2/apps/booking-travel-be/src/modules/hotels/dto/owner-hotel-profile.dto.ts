import { AccommodationPreferenceType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateOwnerHotelDraftDto {
  @IsString()
  @Length(2, 160)
  name!: string;

  @IsEnum(AccommodationPreferenceType)
  accommodationType!: AccommodationPreferenceType;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{12,80}$/)
  clientDraftId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string;
}

export class HotelPolicyPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(3000)
  cancellationPolicy?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  houseRules?: string | null;
}

export class UpdateOwnerHotelProfileDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 160)
  name?: string;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(AccommodationPreferenceType)
  accommodationType?: AccommodationPreferenceType;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  description?: string | null;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 .()-]{7,25}$/)
  contactPhone?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkInTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  checkOutTime?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => HotelPolicyPatchDto)
  policy?: HotelPolicyPatchDto;
}
