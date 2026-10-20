import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, IsUUID, Matches } from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class VerifyOtpDto {
  @ApiProperty({ example: '9f5978d5-93bd-4199-8a09-27897f113abc' })
  @Transform(trimString)
  @IsUUID('4', { message: 'Phiên xác minh không đúng định dạng.' })
  verificationSessionId!: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @Transform(trimString)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP phải gồm đúng 6 chữ số.' })
  otp!: string;
}
