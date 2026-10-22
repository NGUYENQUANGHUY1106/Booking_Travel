import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({
    description:
      'Đặt true để thu hồi toàn bộ phiên đăng nhập của tài khoản. Mặc định chỉ thu hồi phiên hiện tại.',
    default: false,
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean({ message: 'allSessions phải là true hoặc false.' })
  allSessions?: boolean;
}
