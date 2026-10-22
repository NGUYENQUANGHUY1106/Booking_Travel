import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController logout', () => {
  const logout = jest.fn();
  const controller = new AuthController({ logout } as unknown as AuthService);
  const user: AuthenticatedUser = {
    id: 'user-1',
    role: UserRole.USER,
    permissions: [],
    sessionId: 'session-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    logout.mockResolvedValue({ message: 'Đăng xuất thành công.' });
  });

  it('uses the authenticated identity and session instead of client input', async () => {
    await controller.logout({}, user);

    expect(logout).toHaveBeenCalledWith('user-1', 'session-1', undefined);
  });

  it('passes the logout-all selection to the service', async () => {
    await controller.logout({ allSessions: true }, user);

    expect(logout).toHaveBeenCalledWith('user-1', 'session-1', true);
  });

  it('rejects access tokens that do not identify a login session', () => {
    expect(() =>
      controller.logout({}, { ...user, sessionId: undefined }),
    ).toThrow(UnauthorizedException);
    expect(logout).not.toHaveBeenCalled();
  });
});
