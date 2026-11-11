import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

describe('ChatGateway authentication', () => {
  const verifyAsync = jest.fn();
  const userFindUnique = jest.fn();
  const sessionFindFirst = jest.fn();
  const gateway = new ChatGateway(
    {} as ChatService,
    { verifyAsync } as unknown as JwtService,
    {
      user: { findUnique: userFindUnique },
      authSession: { findFirst: sessionFindFirst },
    } as unknown as PrismaService,
  );
  let middleware: (socket: Socket, next: (error?: Error) => void) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway.afterInit({
      use: jest.fn((handler: typeof middleware) => {
        middleware = handler;
      }),
    } as unknown as Server);
  });

  it('accepts an active chat participant session', async () => {
    verifyAsync.mockResolvedValue({ sub: 'user-1', sessionId: 'session-1' });
    userFindUnique.mockResolvedValue({
      id: 'user-1',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      isActive: true,
      ownerApplication: null,
      ownerProfile: null,
    });
    sessionFindFirst.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const socket = {
      handshake: { auth: { token: 'access-token' } },
      data: {},
    } as unknown as Socket;

    await new Promise<void>((resolve, reject) => {
      middleware(socket, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    expect((socket.data as { user?: AuthenticatedUser }).user).toEqual(
      expect.objectContaining({ id: 'user-1', role: UserRole.USER }),
    );
  });

  it('rejects a socket without an access token', async () => {
    const socket = {
      handshake: { auth: {} },
      data: {},
    } as unknown as Socket;

    const error = await new Promise<Error | undefined>((resolve) => {
      middleware(socket, resolve);
    });

    expect(error).toBeInstanceOf(Error);
    expect(verifyAsync).not.toHaveBeenCalled();
  });
});
