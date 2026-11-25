import { IsIn, IsString, Matches } from 'class-validator';

export class RegisterDeviceTokenDto {
  @IsString()
  @Matches(/^ExpoPushToken\[.+\]$|^[a-zA-Z0-9_-]+$/, {
    message: 'Device push token không hợp lệ.',
  })
  token!: string;

  @IsIn(['android', 'ios', 'web'])
  platform!: 'android' | 'ios' | 'web';
}
