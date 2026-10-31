import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserGender } from '@prisma/client';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const emptyToNull = ({ value }: TransformFnParams): unknown => {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn An' })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự.' })
  @MaxLength(120, { message: 'Họ tên không được vượt quá 120 ký tự.' })
  fullName?: string;

  @ApiPropertyOptional({ example: '0901234567', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(/^\+?[0-9][0-9 .()-]{7,28}$/, {
    message: 'Số điện thoại không đúng định dạng.',
  })
  phone?: string | null;

  @ApiPropertyOptional({ example: '1998-08-20', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsDateString(
    { strict: true },
    { message: 'Ngày sinh phải có định dạng YYYY-MM-DD.' },
  )
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ enum: UserGender, nullable: true })
  @IsOptional()
  @IsEnum(UserGender, { message: 'Giới tính không hợp lệ.' })
  gender?: UserGender | null;

  @ApiPropertyOptional({ example: 'Việt Nam', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(100, { message: 'Quốc tịch không được vượt quá 100 ký tự.' })
  nationality?: string | null;

  @ApiPropertyOptional({ example: 'Đà Nẵng, Việt Nam', nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500, { message: 'Địa chỉ không được vượt quá 500 ký tự.' })
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_object, value) => value !== null)
  @IsUrl(
    { protocols: ['http', 'https'], require_protocol: true },
    { message: 'Đường dẫn ảnh đại diện không hợp lệ.' },
  )
  @MaxLength(2_048)
  avatarUrl?: string | null;
}
