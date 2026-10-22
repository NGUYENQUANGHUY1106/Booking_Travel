import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'traveler@bookingtravel.vn',
    description: 'Email hoặc số điện thoại của tài khoản.',
  })
  @Transform(trimString)
  @IsString()
  @MinLength(3, { message: 'Email hoặc số điện thoại không hợp lệ.' })
  @MaxLength(254, { message: 'Email hoặc số điện thoại không hợp lệ.' })
  identifier!: string;
}
