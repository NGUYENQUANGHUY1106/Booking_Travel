import { AddressMode } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ValidateAddressDto {
  @IsEnum(AddressMode)
  mode!: AddressMode;

  @IsString()
  provinceUnitId!: string;

  @IsOptional()
  @IsString()
  districtUnitId?: string;

  @IsString()
  communeUnitId!: string;

  @IsOptional()
  @IsString()
  streetId?: string;
}
