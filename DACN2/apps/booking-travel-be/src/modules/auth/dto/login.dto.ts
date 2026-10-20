import { ApiProperty } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class LoginDto {
  @ApiProperty({ example: 'traveler@bookingtravel.vn' })
  @Transform(trimString)
  @IsString()
  @MinLength(3, { message: 'Email hoặc số điện thoại không hợp lệ.' })
  @MaxLength(254, { message: 'Email hoặc số điện thoại không hợp lệ.' })
  identifier!: string;

  @ApiProperty({ example: 'traveler123' })
  @IsString()
  @MinLength(1, { message: 'Vui lòng nhập mật khẩu.' })
  @MaxLength(72, { message: 'Thông tin đăng nhập không chính xác.' })
  password!: string;
}
