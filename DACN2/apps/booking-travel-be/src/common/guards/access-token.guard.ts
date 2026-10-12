import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest } from '../types/authenticated-request';

interface AccessTokenPayload {
  sub?: string;
  roles?: string[];
}

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice(7)
      : undefined;
    if (!token)
      throw new UnauthorizedException('A bearer access token is required.');

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      if (!payload.sub) throw new Error('missing subject');
      request.user = {
        id: payload.sub,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
      };
      return true;
    } catch {
      throw new UnauthorizedException(
        'The access token is invalid or expired.',
      );
    }
  }
}
