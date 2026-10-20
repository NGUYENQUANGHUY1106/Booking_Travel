import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  it('rejects a client-supplied privileged role', async () => {
    await expect(
      pipe.transform(
        {
          fullName: 'Nguyễn Văn An',
          email: 'an@example.com',
          password: 'Demo1234',
          confirmPassword: 'Demo1234',
          acceptedTerms: true,
          role: 'ADMIN',
        },
        { type: 'body', metatype: RegisterDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires acceptance of the terms', async () => {
    await expect(
      pipe.transform(
        {
          fullName: 'Nguyễn Văn An',
          email: 'an@example.com',
          password: 'Demo1234',
          confirmPassword: 'Demo1234',
          acceptedTerms: false,
        },
        { type: 'body', metatype: RegisterDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
