import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}
