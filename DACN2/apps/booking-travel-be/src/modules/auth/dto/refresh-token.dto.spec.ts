import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { RefreshTokenDto } from './refresh-token.dto';

describe('RefreshTokenDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const refreshToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.signature';

  it('accepts a JWT-shaped refresh token', async () => {
    const result: unknown = await pipe.transform(
      { refreshToken },
      { type: 'body', metatype: RefreshTokenDto },
    );

    expect(result).toBeInstanceOf(RefreshTokenDto);
    expect(result).toMatchObject({ refreshToken });
  });

  it('rejects a malformed token and client-supplied session data', async () => {
    await expect(
      pipe.transform(
        { refreshToken: 'not-a-jwt' },
        { type: 'body', metatype: RefreshTokenDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      pipe.transform(
        { refreshToken, sessionId: 'client-controlled-session' },
        { type: 'body', metatype: RefreshTokenDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
