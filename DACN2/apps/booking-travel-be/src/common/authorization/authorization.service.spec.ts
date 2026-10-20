import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService booking policy', () => {
  const findUnique = jest.fn();
  const service = new AuthorizationService({
    booking: { findUnique },
  } as unknown as PrismaService);

  beforeEach(() => {
    findUnique.mockReset();
    findUnique.mockResolvedValue({
      userId: 'limited-admin',
      hotel: { ownerId: 'owner-b' },
    });
  });

  it('does not let an Admin without BOOKING_SUPPORT use customer ownership as an override', async () => {
    await expect(
      service.assertBookingAccess(
        'booking-1',
        { id: 'limited-admin', role: UserRole.ADMIN, permissions: [] },
        'read',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a User read their own booking but not manage its status', async () => {
    const user = {
      id: 'limited-admin',
      role: UserRole.USER,
      permissions: [],
    };
    await expect(
      service.assertBookingAccess('booking-1', user, 'read'),
    ).resolves.toBeUndefined();
    await expect(
      service.assertBookingAccess('booking-1', user, 'manage'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 404 only when the booking does not exist', async () => {
    findUnique.mockResolvedValueOnce(null);
    await expect(
      service.assertBookingAccess(
        'missing',
        { id: 'owner-a', role: UserRole.HOTEL_OWNER, permissions: [] },
        'read',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
