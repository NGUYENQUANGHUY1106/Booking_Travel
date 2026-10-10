import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsOptional,
  Matches,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ValidateAddressDto } from './validate-address.dto';

export class CreateAddressDto extends ValidateAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  streetText?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  addressLine!: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== '')
  @Matches(/^\d{5,6}$/, {
    message: 'postalCode must contain 5 or 6 digits',
  })
  postalCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
