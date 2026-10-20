import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

interface AccessTokenPayload {
  sub?: string;
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

    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException('Access token không hợp lệ.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        isActive: true,
        adminProfile: { select: { permissions: true } },
      },
    });
    if (!user?.isActive) {
      throw new UnauthorizedException('Tài khoản không còn hoạt động.');
    }

    request.user = {
      id: user.id,
      role: user.role,
      permissions: user.adminProfile?.permissions ?? [],
    };
    return true;
  }
}
