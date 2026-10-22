import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ForgotPasswordDto } from './forgot-password.dto';

describe('ForgotPasswordDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('normalizes surrounding whitespace in the identifier', async () => {
    const result: unknown = await pipe.transform(
      { identifier: ' traveler@example.com ' },
      { type: 'body', metatype: ForgotPasswordDto },
    );

    expect(result).toBeInstanceOf(ForgotPasswordDto);
    expect(result).toMatchObject({ identifier: 'traveler@example.com' });
  });

  it('rejects an empty identifier and extra fields', async () => {
    await expect(
      pipe.transform(
        { identifier: '' },
        { type: 'body', metatype: ForgotPasswordDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      pipe.transform(
        { identifier: 'traveler@example.com', userId: 'client-user-id' },
        { type: 'body', metatype: ForgotPasswordDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
