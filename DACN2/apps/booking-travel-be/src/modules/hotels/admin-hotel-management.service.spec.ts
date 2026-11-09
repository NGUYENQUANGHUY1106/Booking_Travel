import { BadRequestException, ConflictException } from '@nestjs/common';
import { HotelStatus, UserRole, UserStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { HotelMediaService } from './hotel-media.service';
import { AdminHotelManagementService } from './admin-hotel-management.service';

const actor = { id: 'admin-1', role: UserRole.ADMIN } as AuthenticatedUser;
const baseInput = {
  reason: 'Vi phạm quy định niêm yết khách sạn',
  expectedProfileVersion: 2,
  expectedRestrictionVersion: 0,
  requestId: 'adm05-test-001',
};

function setup(status: HotelStatus = HotelStatus.APPROVED, isVisible = true) {
  const updateMany = jest.fn(
    (args: { where: { id: string }; data: { isVisible: boolean } }) => {
      expect(args.where.id).toBe('hotel-a');
      return Promise.resolve({ count: 1 });
    },
  );
  const hotel = {
    id: 'hotel-a',
    ownerId: 'owner-a',
    name: 'Hotel A',
    status,
    isVisible,
    profileVersion: 2,
    restrictionVersion: 0,
    owner: {
      role: UserRole.HOTEL_OWNER,
      status: UserStatus.ACTIVE as UserStatus,
      isActive: true,
      ownerApplication: { status: 'VERIFIED' },
      ownerProfile: { isActive: true },
    },
    policy: { houseRules: 'Không hút thuốc', cancellationPolicy: null },
    submissions: [{ version: 2, status: 'APPROVED' }],
    rooms: [{ id: 'room-a' }],
    accommodationType: 'HOTEL',
    contactPhone: '0123456789',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    addressLine: '1 Main St',
    provinceUnitId: 'P1',
    wardUnitId: 'W1',
    latitude: 1,
    longitude: 1,
    coverImageUrl: 'cover.jpg',
  };
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    hotelRestrictionAudit: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    hotel: {
      findFirst: jest.fn().mockResolvedValue(hotel),
      updateMany,
    },
    hotelMedia: { count: jest.fn().mockResolvedValue(1) },
    booking: { findMany: jest.fn().mockResolvedValue([{ id: 'booking-a' }]) },
    hotelRestrictionNotification: { create: jest.fn().mockResolvedValue({}) },
    hotelBookingOperationalTask: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const service = new AdminHotelManagementService(
    prisma as unknown as PrismaService,
    {} as HotelMediaService,
  );
  return { service, tx, hotel };
}

describe('AdminHotelManagementService decisions', () => {
  it('rejects whitespace-only reasons before opening a transaction', async () => {
    const { service, tx } = setup();
    await expect(
      service.decide('hotel-a', actor, {
        ...baseInput,
        action: 'HIDE',
        reason: '            ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.hotel.updateMany).not.toHaveBeenCalled();
  });
  it('hides one approved hotel, records audit/owner notice and an operational task without touching bookings', async () => {
    const { service, tx } = setup();
    const result = await service.decide('hotel-a', actor, {
      ...baseInput,
      action: 'HIDE',
    });
    expect(result).toMatchObject({
      status: HotelStatus.APPROVED,
      isVisible: false,
      futureBookingCount: 1,
    });
    const update = tx.hotel.updateMany.mock.calls[0][0];
    expect(update.where.id).toBe('hotel-a');
    expect(update.data.isVisible).toBe(false);
    expect(tx.hotelRestrictionAudit.create).toHaveBeenCalledTimes(1);
    expect(tx.hotelRestrictionNotification.create).toHaveBeenCalledTimes(1);
    expect(tx.hotelBookingOperationalTask.createMany).toHaveBeenCalledWith({
      data: [
        { decisionId: 'audit-1', hotelId: 'hotel-a', bookingId: 'booking-a' },
      ],
    });
  });

  it('rejects a stale Admin decision before writing an audit or state', async () => {
    const { service, tx } = setup();
    await expect(
      service.decide('hotel-a', actor, {
        ...baseInput,
        action: 'SUSPEND',
        expectedRestrictionVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.hotel.updateMany).not.toHaveBeenCalled();
    expect(tx.hotelRestrictionAudit.create).not.toHaveBeenCalled();
  });

  it('blocks restore when owner is suspended', async () => {
    const { service, tx, hotel } = setup(HotelStatus.SUSPENDED, false);
    hotel.owner.status = UserStatus.SUSPENDED;
    await expect(
      service.decide('hotel-a', actor, { ...baseInput, action: 'RESTORE' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.hotel.updateMany).not.toHaveBeenCalled();
  });

  it('returns the first decision on retry without another notification', async () => {
    const { service, tx } = setup();
    tx.hotelRestrictionAudit.findUnique.mockResolvedValueOnce({
      hotelId: 'hotel-a',
      actorId: actor.id,
      action: 'HIDE',
      reason: baseInput.reason,
      evidenceReference: null,
      profileVersion: 2,
      restrictionVersion: 1,
      afterStatus: HotelStatus.APPROVED,
      afterVisible: false,
      futureBookingCount: 1,
    });
    const result = await service.decide('hotel-a', actor, {
      ...baseInput,
      action: 'HIDE',
    });
    expect(result.isVisible).toBe(false);
    expect(tx.hotel.updateMany).not.toHaveBeenCalled();
    expect(tx.hotelRestrictionNotification.create).not.toHaveBeenCalled();
  });
});
