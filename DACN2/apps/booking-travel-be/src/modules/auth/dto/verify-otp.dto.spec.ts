import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { VerifyOtpDto } from './verify-otp.dto';

describe('VerifyOtpDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('accepts a UUID v4 session and a six-digit OTP', async () => {
    await expect(
      pipe.transform(
        {
          verificationSessionId: '9f5978d5-93bd-4199-8a09-27897f113abc',
          otp: '123456',
        },
        { type: 'body', metatype: VerifyOtpDto },
      ),
    ).resolves.toBeInstanceOf(VerifyOtpDto);
  });

  it('rejects a malformed session or non-numeric OTP', async () => {
    await expect(
      pipe.transform(
        { verificationSessionId: 'invalid', otp: '12AB56' },
        { type: 'body', metatype: VerifyOtpDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
