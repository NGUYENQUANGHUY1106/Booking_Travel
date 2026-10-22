import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from './auth.service';

const CURRENT_REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.current-signature';
const ROTATED_REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.rotated-signature';

const hashRefreshToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

type SessionUpdateInput = {
  where: {
    id: string;
    userId?: string;
    refreshTokenHash?: string;
    revokedAt: null;
    expiresAt?: { gt: Date };
  };
  data: {
    refreshTokenHash?: string;
    expiresAt?: Date;
    lastUsedAt: Date;
    userAgent?: string;
    ipAddress?: string;
    revokedAt?: Date;
  };
};

describe('AuthService refresh', () => {
  const activeSession = {
    id: 'session-1',
    userId: 'user-1',
    refreshTokenHash: hashRefreshToken(CURRENT_REFRESH_TOKEN),
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    user: {
      id: 'user-1',
      fullName: 'Chủ khách sạn',
      email: 'owner@example.com',
      phone: null,
      role: UserRole.HOTEL_OWNER,
      status: UserStatus.ACTIVE,
      isActive: true,
    },
  };
  const authSessionFindUnique = jest.fn();
  const authSessionUpdateMany = jest.fn<
    Promise<{ count: number }>,
    [SessionUpdateInput]
  >();
  const prisma = {
    authSession: {
      findUnique: authSessionFindUnique,
      updateMany: authSessionUpdateMany,
    },
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
  const verifyAsync = jest.fn<
    Promise<Record<string, unknown>>,
    [string, { secret: string }]
  >();
  const signAsync = jest.fn<
    Promise<string>,
    [Record<string, unknown>, { secret: string; expiresIn: number }]
  >();
  const jwt = { verifyAsync, signAsync } as unknown as JwtService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyAsync.mockResolvedValue({
      sub: activeSession.user.id,
      sessionId: activeSession.id,
      type: 'refresh',
      role: UserRole.USER,
    });
    authSessionFindUnique.mockResolvedValue(activeSession);
    authSessionUpdateMany.mockResolvedValue({ count: 1 });
    signAsync
      .mockResolvedValueOnce('new-access-token')
      .mockResolvedValueOnce(ROTATED_REFRESH_TOKEN);
    service = new AuthService(prisma, config, jwt);
  });

  it('rotates the refresh token and uses current database role data', async () => {
    const response = await service.refresh(
      { refreshToken: CURRENT_REFRESH_TOKEN },
      { ipAddress: '127.0.0.1', userAgent: 'test-device' },
    );

    expect(verifyAsync).toHaveBeenCalledWith(CURRENT_REFRESH_TOKEN, {
      secret: 'refresh-secret',
    });
    expect(authSessionFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: activeSession.id } }),
    );
    expect(signAsync.mock.calls[0][0]).toMatchObject({
      sub: activeSession.user.id,
      role: UserRole.HOTEL_OWNER,
      roles: [UserRole.HOTEL_OWNER],
      sessionId: activeSession.id,
    });
    expect(signAsync.mock.calls[1][0]).toMatchObject({ type: 'refresh' });

    const rotation = authSessionUpdateMany.mock.calls[0][0];
    expect(rotation.where).toMatchObject({
      id: activeSession.id,
      userId: activeSession.user.id,
      refreshTokenHash: hashRefreshToken(CURRENT_REFRESH_TOKEN),
      revokedAt: null,
    });
    expect(rotation.data).toMatchObject({
      refreshTokenHash: hashRefreshToken(ROTATED_REFRESH_TOKEN),
      ipAddress: '127.0.0.1',
      userAgent: 'test-device',
    });
    expect(rotation.data.refreshTokenHash).not.toBe(ROTATED_REFRESH_TOKEN);
    expect(response).toMatchObject({
      accessToken: 'new-access-token',
      refreshToken: ROTATED_REFRESH_TOKEN,
      sessionId: activeSession.id,
      user: { role: UserRole.HOTEL_OWNER },
    });
  });

  it('rejects an invalid signature without reading a session', async () => {
    verifyAsync.mockRejectedValueOnce(new Error('invalid signature'));

    await expect(
      service.refresh({ refreshToken: CURRENT_REFRESH_TOKEN }),
    ).rejects.toMatchObject({
      response: { code: 'AUTH_REFRESH_TOKEN_INVALID' },
    });
    expect(authSessionFindUnique).not.toHaveBeenCalled();
  });

  it.each([
    ['revoked', { revokedAt: new Date() }],
    ['expired', { expiresAt: new Date(Date.now() - 1_000) }],
    ['rotated', { refreshTokenHash: hashRefreshToken('older-token') }],
  ])('rejects a %s refresh token', async (_state, override) => {
    authSessionFindUnique.mockResolvedValueOnce({
      ...activeSession,
      ...override,
    });

    await expect(
      service.refresh({ refreshToken: CURRENT_REFRESH_TOKEN }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('revokes the session when the account has been suspended', async () => {
    authSessionFindUnique.mockResolvedValueOnce({
      ...activeSession,
      user: { ...activeSession.user, status: UserStatus.SUSPENDED },
    });

    await expect(
      service.refresh({ refreshToken: CURRENT_REFRESH_TOKEN }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const revocation = authSessionUpdateMany.mock.calls[0][0];
    expect(revocation.where).toEqual({
      id: activeSession.id,
      revokedAt: null,
    });
    expect(revocation.data.revokedAt).toBeInstanceOf(Date);
    expect(revocation.data.lastUsedAt).toBeInstanceOf(Date);
    expect(signAsync).not.toHaveBeenCalled();
  });

  it('rejects a replay when another request already rotated the token', async () => {
    authSessionUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.refresh({ refreshToken: CURRENT_REFRESH_TOKEN }),
    ).rejects.toMatchObject({
      response: { code: 'AUTH_REFRESH_TOKEN_INVALID' },
    });
  });
});
