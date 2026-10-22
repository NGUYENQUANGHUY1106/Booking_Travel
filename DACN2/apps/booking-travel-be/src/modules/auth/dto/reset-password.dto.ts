import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ResetPasswordDto {
  @ApiProperty({ example: '9f5978d5-93bd-4199-8a09-27897f113abc' })
  @Transform(trimString)
  @IsUUID('4', { message: 'Phiên đặt lại mật khẩu không đúng định dạng.' })
  resetSessionId!: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @Transform(trimString)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP phải gồm đúng 6 chữ số.' })
  otp!: string;

  @ApiProperty({ example: 'NewPassword123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự.' })
  @MaxLength(72, { message: 'Mật khẩu mới không được vượt quá 72 ký tự.' })
  newPassword!: string;

  @ApiProperty({ example: 'NewPassword123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu xác nhận phải có ít nhất 8 ký tự.' })
  @MaxLength(72, {
    message: 'Mật khẩu xác nhận không được vượt quá 72 ký tự.',
  })
  confirmPassword!: string;
}
