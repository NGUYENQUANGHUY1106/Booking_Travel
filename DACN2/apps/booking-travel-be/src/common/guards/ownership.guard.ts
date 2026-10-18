import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  OWNED_RESOURCE_KEY,
  OwnedResourcePolicy,
} from '../decorators/owned-resource.decorator';
import { AuthenticatedRequest } from '../types/authenticated-request';

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.get<OwnedResourcePolicy>(
      OWNED_RESOURCE_KEY,
      context.getHandler(),
    );
    if (!policy) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user) throw new UnauthorizedException('Cần đăng nhập.');
    const id = request.params[policy.param];
    if (typeof id !== 'string' || !id) {
      throw new BadRequestException('ID tài nguyên không hợp lệ.');
    }

    if (policy.resource === 'hotel') {
      await this.authorization.assertHotelOwner(id, request.user);
    } else if (policy.resource === 'room') {
      await this.authorization.assertRoomOwner(id, request.user);
    } else {
      await this.authorization.assertBookingAccess(
        id,
        request.user,
        policy.action,
      );
    }
    return true;
  }
}
