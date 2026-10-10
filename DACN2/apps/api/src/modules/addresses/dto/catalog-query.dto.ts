import { AdministrativeCatalogMode, AdministrativeLevel } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CatalogModeQueryDto {
  @IsOptional()
  @IsEnum(AdministrativeCatalogMode)
  mode: AdministrativeCatalogMode = AdministrativeCatalogMode.CURRENT;
}

export class SearchCatalogQueryDto extends CatalogModeQueryDto {
  @IsString()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @IsEnum(AdministrativeLevel)
  level?: AdministrativeLevel;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class StreetSearchQueryDto {
  @IsString()
  communeId!: string;

  @IsString()
  @MinLength(1)
  q!: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(30)
  limit = 15;
}
