import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LoginDto } from './login.dto';

describe('LoginDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('normalizes surrounding whitespace in the identifier', async () => {
    const result: unknown = await pipe.transform(
      { identifier: ' traveler@example.com ', password: 'Demo1234' },
      { type: 'body', metatype: LoginDto },
    );

    expect(result).toBeInstanceOf(LoginDto);
    if (!(result instanceof LoginDto)) throw new Error('DTO transform failed.');
    expect(result.identifier).toBe('traveler@example.com');
  });

  it('rejects missing credentials and client-supplied role', async () => {
    await expect(
      pipe.transform(
        { identifier: '', password: '' },
        { type: 'body', metatype: LoginDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      pipe.transform(
        {
          identifier: 'traveler@example.com',
          password: 'Demo1234',
          role: 'ADMIN',
        },
        { type: 'body', metatype: LoginDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
