import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ALLOW_INACTIVE_SESSION_KEY } from '../decorators/allow-inactive-session.decorator';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

interface AccessTokenPayload {
  sub?: string;
  sessionId?: unknown;
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowInactiveSession = this.reflector.getAllAndOverride<boolean>(
      ALLOW_INACTIVE_SESSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!token) {
      if (isPublic && !authorization) return true;
      throw new UnauthorizedException('Cần access token hợp lệ.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'Access token không hợp lệ hoặc đã hết hạn.',
      );
    }

    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.sessionId !== 'string' ||
      !payload.sessionId
    ) {
      throw new UnauthorizedException('Access token không hợp lệ.');
    }

    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          role: true,
          status: true,
          isActive: true,
          adminProfile: { select: { permissions: true } },
        },
      }),
      this.prisma.authSession.findFirst({
        where: { id: payload.sessionId, userId: payload.sub },
        select: { revokedAt: true, expiresAt: true },
      }),
    ]);
    if (!user?.isActive || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }
    if (
      !allowInactiveSession &&
      (!session || session.revokedAt || session.expiresAt <= new Date())
    ) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực.');
    }

    request.user = {
      id: user.id,
      role: user.role,
      permissions: user.adminProfile?.permissions ?? [],
      sessionId: payload.sessionId,
    };
    return true;
  }
}
