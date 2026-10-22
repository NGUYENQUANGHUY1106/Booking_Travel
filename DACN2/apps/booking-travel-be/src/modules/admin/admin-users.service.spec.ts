import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminUsersService } from './admin-users.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';

describe('ST-ADM-02 account management', () => {
  const actor: AuthenticatedUser = {
    id: 'admin-actor',
    role: UserRole.ADMIN,
    permissions: ['USER_MANAGEMENT'],
  };
  const target: { id: string; role: UserRole; status: UserStatus } = {
    id: 'target-user-1',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
  };
  const userFindUnique = jest.fn();
  const userUpdateMany = jest.fn();
  const sessionUpdateMany = jest.fn();
  const auditCreate = jest.fn();
  const userCount = jest.fn();
  const userFindMany = jest.fn();
  const sessionFindFirst = jest.fn();
  const auditFindMany = jest.fn();
  const database = {
    user: {
      findUnique: userFindUnique,
      updateMany: userUpdateMany,
      count: userCount,
      findMany: userFindMany,
    },
    authSession: { updateMany: sessionUpdateMany, findFirst: sessionFindFirst },
    adminUserAudit: { create: auditCreate, findMany: auditFindMany },
  };
  const prisma = {
    ...database,
    $transaction: jest.fn(
      (
        operation: ((client: typeof database) => unknown) | Promise<unknown>[],
      ) =>
        typeof operation === 'function'
          ? Promise.resolve(operation(database))
          : Promise.all(operation),
    ),
  } as unknown as PrismaService;
  const service = new AdminUsersService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    target.status = UserStatus.ACTIVE;
    target.role = UserRole.USER;
    userFindUnique.mockImplementation(() => Promise.resolve({ ...target }));
    userUpdateMany.mockImplementation(
      ({
        where,
        data,
      }: {
        where: { status: UserStatus };
        data: { status: UserStatus };
      }) => {
        if (where.status !== target.status)
          return Promise.resolve({ count: 0 });
        target.status = data.status;
        return Promise.resolve({ count: 1 });
      },
    );
    sessionUpdateMany.mockResolvedValue({ count: 1 });
    auditCreate.mockResolvedValue({
      id: 'audit-1',
      createdAt: new Date('2026-10-22T00:00:00Z'),
    });
    userCount.mockResolvedValue(21);
    userFindMany.mockResolvedValue([{ id: target.id, authSessions: [] }]);
    sessionFindFirst.mockResolvedValue({
      lastUsedAt: new Date('2026-10-21T00:00:00Z'),
    });
    auditFindMany.mockResolvedValue([]);
  });

  it('queries the database with search, role, status, sorting and server pagination', async () => {
    const query = Object.assign(new AdminUserQueryDto(), {
      search: 'Quang',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      page: 2,
      limit: 10,
      sortBy: 'fullName',
      sortOrder: 'asc',
    });
    const result = await service.list(query, actor);

    expect(result).toMatchObject({
      total: 21,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
    const listOptions = (userFindMany.mock.calls as unknown[][])[0][0] as {
      skip: number;
      take: number;
      orderBy: object[];
      where: { role: UserRole; status: UserStatus; OR: object[] };
    };
    expect(listOptions.skip).toBe(10);
    expect(listOptions.take).toBe(10);
    expect(listOptions.orderBy).toEqual([{ fullName: 'asc' }, { id: 'asc' }]);
    expect(listOptions.where.role).toBe(UserRole.USER);
    expect(listOptions.where.status).toBe(UserStatus.ACTIVE);
    expect(listOptions.where.OR).toHaveLength(3);
  });

  it('suspends an active account, revokes sessions, and writes actor, reason and status audit atomically', async () => {
    const result = await service.changeStatus(
      target.id,
      'SUSPEND',
      ' Vi phạm chính sách ',
      actor,
    );

    expect(result.status).toBe(UserStatus.SUSPENDED);
    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: target.id, status: UserStatus.ACTIVE },
      data: { status: UserStatus.SUSPENDED, isActive: false },
    });
    const sessionUpdate = (
      sessionUpdateMany.mock.calls as unknown[][]
    )[0][0] as {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    };
    expect(sessionUpdate.where).toEqual({ userId: target.id, revokedAt: null });
    expect(sessionUpdate.data.revokedAt).toBeInstanceOf(Date);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          actorId: actor.id,
          targetUserId: target.id,
          action: 'SUSPEND',
          oldStatus: UserStatus.ACTIVE,
          newStatus: UserStatus.SUSPENDED,
          reason: 'Vi phạm chính sách',
        },
      }),
    );
  });

  it('keeps LOCK distinct from SUSPEND and does not revive revoked sessions on UNLOCK or RESTORE', async () => {
    await service.changeStatus(target.id, 'LOCK', 'Khóa để rà soát', actor);
    expect(target.status).toBe(UserStatus.LOCKED);
    await service.changeStatus(target.id, 'UNLOCK', 'Đã rà soát', actor);
    expect(target.status).toBe(UserStatus.ACTIVE);
    await service.changeStatus(target.id, 'SUSPEND', 'Cần xử lý', actor);
    await service.changeStatus(target.id, 'RESTORE', 'Đã xử lý', actor);
    expect(target.status).toBe(UserStatus.ACTIVE);
    expect(sessionUpdateMany).toHaveBeenCalledTimes(2);
  });

  it('rejects conflicts and does not create duplicate audit events', async () => {
    await service.changeStatus(target.id, 'SUSPEND', 'Vi phạm', actor);
    await expect(
      service.changeStatus(target.id, 'SUSPEND', 'Vi phạm', actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(auditCreate).toHaveBeenCalledTimes(1);
  });

  it('rejects blank reasons, self-action, other Admin accounts and missing permissions', async () => {
    await expect(
      service.changeStatus(target.id, 'LOCK', '  ', actor),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.changeStatus(actor.id, 'LOCK', 'Lý do', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    target.role = UserRole.ADMIN;
    await expect(
      service.changeStatus(target.id, 'LOCK', 'Lý do', actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.list(new AdminUserQueryDto(), { ...actor, permissions: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
