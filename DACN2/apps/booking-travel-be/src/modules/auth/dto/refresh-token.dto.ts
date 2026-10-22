import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token được cấp khi đăng nhập.' })
  @IsString()
  @IsJWT({ message: 'Refresh token không hợp lệ.' })
  @MaxLength(4_096, { message: 'Refresh token không hợp lệ.' })
  refreshToken!: string;
}
