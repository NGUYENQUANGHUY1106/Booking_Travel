import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthService } from './auth.service';

type SessionUpdateInput = {
  where: {
    id?: string;
    userId: string;
    revokedAt: null;
  };
  data: {
    revokedAt: Date;
    lastUsedAt: Date;
  };
};

describe('AuthService logout', () => {
  const authSessionUpdateMany = jest.fn<
    Promise<{ count: number }>,
    [SessionUpdateInput]
  >();
  const prisma = {
    authSession: { updateMany: authSessionUpdateMany },
  } as unknown as PrismaService;
  const service = new AuthService(
    prisma,
    {} as ConfigService,
    {} as JwtService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    authSessionUpdateMany.mockResolvedValue({ count: 1 });
  });

  it('revokes only the current session owned by the authenticated user', async () => {
    const response = await service.logout('user-1', 'session-1');

    expect(authSessionUpdateMany).toHaveBeenCalledTimes(1);
    const mutation = authSessionUpdateMany.mock.calls[0][0];
    expect(mutation.where).toEqual({
      id: 'session-1',
      userId: 'user-1',
      revokedAt: null,
    });
    expect(mutation.data.revokedAt).toBeInstanceOf(Date);
    expect(mutation.data.lastUsedAt).toBe(mutation.data.revokedAt);
    expect(response).toEqual({
      message: 'Đăng xuất thành công.',
      scope: 'CURRENT',
      revokedSessionCount: 1,
    });
  });

  it('revokes every unrevoked session when logout all is selected', async () => {
    authSessionUpdateMany.mockResolvedValueOnce({ count: 3 });

    const response = await service.logout('user-1', 'session-1', true);

    expect(authSessionUpdateMany).toHaveBeenCalledTimes(1);
    const mutation = authSessionUpdateMany.mock.calls[0][0];
    expect(mutation.where).toEqual({ userId: 'user-1', revokedAt: null });
    expect(mutation.data.revokedAt).toBeInstanceOf(Date);
    expect(mutation.data.lastUsedAt).toBe(mutation.data.revokedAt);
    expect(response).toEqual({
      message: 'Đã đăng xuất khỏi tất cả phiên đăng nhập.',
      scope: 'ALL',
      revokedSessionCount: 3,
    });
  });

  it('is idempotent when the selected session is already revoked or missing', async () => {
    authSessionUpdateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.logout('user-1', 'session-1')).resolves.toEqual({
      message: 'Đăng xuất thành công.',
      scope: 'CURRENT',
      revokedSessionCount: 0,
    });
  });
});
