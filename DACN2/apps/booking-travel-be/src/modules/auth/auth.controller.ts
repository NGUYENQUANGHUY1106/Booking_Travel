import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'ST-AUTH-03 - Đăng nhập' })
  @ApiOkResponse({
    description: 'Xác thực thành công và tạo phiên đăng nhập.',
  })
  login(@Body() input: LoginDto, @Req() request: Request) {
    return this.auth.login(input, {
      ipAddress: request.ip?.slice(0, 64),
      userAgent: request.get('user-agent')?.slice(0, 512),
    });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'ST-AUTH-01 - Đăng ký tài khoản người dùng' })
  @ApiCreatedResponse({
    description: 'Tạo tài khoản USER và phiên xác minh thành công.',
  })
  register(@Body() input: RegisterDto) {
    return this.auth.register(input);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'ST-AUTH-02 - Xác minh OTP/email' })
  @ApiOkResponse({
    description: 'Xác minh thành công và kích hoạt tài khoản đăng ký.',
  })
  verify(@Body() input: VerifyOtpDto) {
    return this.auth.verify(input);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'ST-AUTH-02 - Gửi lại OTP xác minh' })
  @ApiOkResponse({ description: 'Tạo OTP mới sau thời gian cooldown.' })
  resendVerification(@Body() input: ResendVerificationDto) {
    return this.auth.resendVerification(input);
  }
}
