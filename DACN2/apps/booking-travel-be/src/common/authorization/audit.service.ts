import { Injectable, Logger } from '@nestjs/common';
import { AuthenticatedUser } from '../types/authenticated-user';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuthorizationAudit');

  recordSuccess(
    actor: AuthenticatedUser,
    action: string,
    resourceType: string,
    resourceId: string,
  ): void {
    this.logger.log(
      JSON.stringify({
        actorId: actor.id,
        actorRole: actor.role,
        action,
        resourceType,
        resourceId,
        outcome: 'SUCCESS',
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
