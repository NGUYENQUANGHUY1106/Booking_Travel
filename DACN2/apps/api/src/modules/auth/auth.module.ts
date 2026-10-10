import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.accessSecret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  providers: [AccessTokenGuard],
  exports: [JwtModule, AccessTokenGuard],
})
export class AuthModule {}
