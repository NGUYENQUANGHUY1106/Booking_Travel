import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuditService } from '../../common/authorization/audit.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminService } from './admin.service';

describe('AdminService audit and permission assignment', () => {
  const actor: AuthenticatedUser = {
    id: 'admin-1',
    role: UserRole.ADMIN,
    permissions: ['USER_MANAGEMENT'],
  };
  const admin = { id: 'profile-2', userId: 'user-2' };
  const transaction = {
    user: { update: jest.fn().mockResolvedValue({ id: 'user-2' }) },
    adminProfile: { create: jest.fn().mockResolvedValue(admin) },
  };
  const findUniqueMock = jest
    .fn()
    .mockResolvedValue({ id: 'user-2', adminProfile: null });
  const transactionMock = jest.fn(
    (callback: (client: typeof transaction) => unknown) =>
      Promise.resolve(callback(transaction)),
  );
  const recordSuccessMock = jest.fn();
  const prisma = {
    user: { findUnique: findUniqueMock },
    $transaction: transactionMock,
  } as unknown as PrismaService;
  const audit = { recordSuccess: recordSuccessMock } as unknown as AuditService;
  const service = new AdminService(prisma, audit);

  beforeEach(() => jest.clearAllMocks());

  it('records actor and resource only after a successful admin mutation', async () => {
    await expect(
      service.create(
        { userId: 'user-2', permissions: ['USER_MANAGEMENT'] },
        actor,
      ),
    ).resolves.toEqual(admin);
    expect(recordSuccessMock).toHaveBeenCalledWith(
      actor,
      'ADMIN_CREATE',
      'ADMIN_PROFILE',
      admin.id,
    );
  });

  it('does not log success when the transaction fails', async () => {
    transactionMock.mockRejectedValueOnce(new Error('database failure'));
    await expect(service.create({ userId: 'user-2' }, actor)).rejects.toThrow(
      'database failure',
    );
    expect(recordSuccessMock).not.toHaveBeenCalled();
  });

  it('rejects assigning a permission the actor does not have', async () => {
    await expect(
      service.create(
        { userId: 'user-2', permissions: ['BOOKING_SUPPORT'] },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(recordSuccessMock).not.toHaveBeenCalled();
  });
});
