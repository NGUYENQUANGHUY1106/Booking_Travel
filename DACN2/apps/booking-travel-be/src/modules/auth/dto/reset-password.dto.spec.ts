import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ResetPasswordDto } from './reset-password.dto';

describe('ResetPasswordDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const validInput = {
    resetSessionId: '9f5978d5-93bd-4199-8a09-27897f113abc',
    otp: '123456',
    newPassword: 'NewPassword123',
    confirmPassword: 'NewPassword123',
  };

  it('accepts a valid password reset payload', async () => {
    const result: unknown = await pipe.transform(validInput, {
      type: 'body',
      metatype: ResetPasswordDto,
    });

    expect(result).toBeInstanceOf(ResetPasswordDto);
    expect(result).toMatchObject(validInput);
  });

  it('rejects invalid OTP, weak passwords and extra fields', async () => {
    await expect(
      pipe.transform(
        { ...validInput, otp: '12345', newPassword: 'short' },
        { type: 'body', metatype: ResetPasswordDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      pipe.transform(
        { ...validInput, role: 'ADMIN' },
        { type: 'body', metatype: ResetPasswordDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
