import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { compare } from 'bcryptjs';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService login', () => {
  const activeUser = {
    id: 'user-1',
    fullName: 'Khách du lịch',
    email: 'traveler@example.com',
    phone: null,
    passwordHash: '$2b$12$stored-hash',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isActive: true,
  };
  const userFindFirst = jest.fn();
  const authSessionCreate = jest.fn<
    Promise<{ id: string }>,
    [
      {
        data: {
          id: string;
          userId: string;
          refreshTokenHash: string;
          userAgent?: string;
          ipAddress?: string;
          expiresAt: Date;
          lastUsedAt: Date;
        };
      },
    ]
  >();
  const prisma = {
    user: { findFirst: userFindFirst },
    authSession: { create: authSessionCreate },
  } as unknown as PrismaService;
  const configValues: Record<string, unknown> = {
    'auth.accessSecret': 'access-secret',
    'auth.refreshSecret': 'refresh-secret',
    'auth.accessTtlSeconds': 900,
    'auth.refreshTtlSeconds': 2_592_000,
  };
  const config = {
    get: jest.fn((key: string, fallback?: unknown) =>
      key in configValues ? configValues[key] : fallback,
    ),
  } as unknown as ConfigService;
  const signAsync = jest.fn<
    Promise<string>,
    [Record<string, unknown>, { secret: string; expiresIn: number }]
  >();
  const jwt = { signAsync } as unknown as JwtService;
  const mockedCompare = compare as unknown as jest.MockedFunction<
    (password: string, passwordHash: string) => Promise<boolean>
  >;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    userFindFirst.mockResolvedValue(activeUser);
    authSessionCreate.mockResolvedValue({ id: 'session-1' });
    mockedCompare.mockResolvedValue(true);
    signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    service = new AuthService(prisma, config, jwt);
  });

  it('logs in an active account and stores a revocable refresh session', async () => {
    const response = await service.login(
      { identifier: ' Traveler@Example.com ', password: 'Demo1234' },
      { ipAddress: '127.0.0.1', userAgent: 'test-device' },
    );

    expect(userFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'traveler@example.com' } }),
    );
    expect(mockedCompare).toHaveBeenCalledWith(
      'Demo1234',
      activeUser.passwordHash,
    );
    const [accessClaims, accessOptions] = signAsync.mock.calls[0];
    expect(accessClaims).toMatchObject({
      sub: activeUser.id,
      role: UserRole.USER,
      roles: [UserRole.USER],
    });
    expect(typeof accessClaims.sessionId).toBe('string');
    expect(accessOptions).toEqual({ secret: 'access-secret', expiresIn: 900 });

    const createdSession = authSessionCreate.mock.calls[0][0].data;
    expect(createdSession).toMatchObject({
      userId: activeUser.id,
      ipAddress: '127.0.0.1',
      userAgent: 'test-device',
    });
    expect(createdSession.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createdSession.refreshTokenHash).not.toBe('refresh-token');
    expect(response).toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: activeUser.id, role: UserRole.USER },
    });
    expect(response.user).not.toHaveProperty('passwordHash');
  });

  it('returns the same generic error for an unknown account or wrong password', async () => {
    userFindFirst.mockResolvedValueOnce(null);
    await expect(
      service.login({ identifier: 'missing@example.com', password: 'wrong' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    userFindFirst.mockResolvedValueOnce(activeUser);
    mockedCompare.mockResolvedValueOnce(false);
    await expect(
      service.login({ identifier: activeUser.email, password: 'wrong' }),
    ).rejects.toMatchObject({
      response: { code: 'AUTH_INVALID_CREDENTIALS' },
    });
    expect(authSessionCreate).not.toHaveBeenCalled();
  });

  it.each([
    [UserStatus.PENDING_VERIFICATION, true, 'AUTH_ACCOUNT_NOT_VERIFIED'],
    [UserStatus.SUSPENDED, true, 'AUTH_ACCOUNT_SUSPENDED'],
    [UserStatus.LOCKED, false, 'AUTH_ACCOUNT_LOCKED'],
    [UserStatus.DISABLED, false, 'AUTH_ACCOUNT_DISABLED'],
  ])(
    'blocks accounts with status %s',
    async (status, isActive, expectedCode) => {
      userFindFirst.mockResolvedValue({ ...activeUser, status, isActive });

      await expect(
        service.login({
          identifier: activeUser.email,
          password: 'Demo1234',
        }),
      ).rejects.toMatchObject({
        response: { code: expectedCode },
      });
      await expect(
        service.login({
          identifier: activeUser.email,
          password: 'Demo1234',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
});
