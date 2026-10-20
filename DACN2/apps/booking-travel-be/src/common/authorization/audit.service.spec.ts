import { Logger } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('logs an admin result without credentials or request body', () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const audit = new AuditService();
    audit.recordSuccess(
      { id: 'admin-1', role: UserRole.ADMIN, permissions: ['USER_MANAGEMENT'] },
      'ADMIN_UPDATE',
      'ADMIN_PROFILE',
      'profile-1',
    );

    const record = log.mock.calls[0][0] as string;
    expect(record).toContain('"actorId":"admin-1"');
    expect(record).toContain('"resourceId":"profile-1"');
    expect(record).toContain('"outcome":"SUCCESS"');
    expect(record).not.toContain('permissions');
    expect(record).not.toContain('token');
    log.mockRestore();
  });
});
