import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.accessSecret'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 5,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenGuard],
  exports: [JwtModule, AuthService, AccessTokenGuard],
})
export class AuthModule {}
