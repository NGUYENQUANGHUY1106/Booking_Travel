import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalString = ({ value }: TransformFnParams): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export class RegisterDto {
  @ApiProperty({ example: 'Nguyễn Văn An', minLength: 2, maxLength: 120 })
  @Transform(trimString)
  @IsString()
  @MinLength(2, { message: 'Họ tên phải có ít nhất 2 ký tự.' })
  @MaxLength(120, { message: 'Họ tên không được vượt quá 120 ký tự.' })
  fullName!: string;

  @ApiPropertyOptional({ example: 'an@example.com', maxLength: 254 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsEmail({}, { message: 'Email không đúng định dạng.' })
  @MaxLength(254, { message: 'Email không được vượt quá 254 ký tự.' })
  email?: string;

  @ApiPropertyOptional({ example: '0901234567', maxLength: 30 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'Số điện thoại không hợp lệ.' })
  phone?: string;

  @ApiProperty({ example: 'Demo1234', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
  @MaxLength(72, { message: 'Mật khẩu không được vượt quá 72 ký tự.' })
  password!: string;

  @ApiProperty({ example: 'Demo1234', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu xác nhận phải có ít nhất 8 ký tự.' })
  @MaxLength(72, {
    message: 'Mật khẩu xác nhận không được vượt quá 72 ký tự.',
  })
  confirmPassword!: string;

  @ApiProperty({ example: true })
  @IsBoolean({ message: 'Giá trị chấp nhận điều khoản phải là boolean.' })
  @Equals(true, { message: 'Bạn phải chấp nhận điều khoản sử dụng.' })
  acceptedTerms!: boolean;
}
