import { ConflictException, ForbiddenException } from '@nestjs/common';
import { HotelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PricingService } from './pricing.service';

const owner: AuthenticatedUser = {
  id: 'owner-a',
  role: 'HOTEL_OWNER',
  permissions: [],
};
const room = {
  id: 'room-b',
  hotelId: 'hotel-b',
  name: 'Suite',
  quantity: 2,
  basePrice: new Prisma.Decimal('1000000'),
  currency: 'VND',
  pricingVersion: 2,
  hotel: { ownerId: 'owner-b', status: HotelStatus.APPROVED },
};

describe('ST-OWN-09 Owner pricing gate', () => {
  it('does not disclose another owner room calendar', async () => {
    const findFirst = jest.fn().mockResolvedValue(room);
    const findMany = jest.fn();
    const service = new PricingService({
      room: { findFirst },
      roomPricingRule: { findMany },
    } as unknown as PrismaService);
    await expect(
      service.month(owner, 'hotel-b', 'room-b', '2028-02'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects a stale pricing version before any write', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ locked: 1 }]),
      room: {
        findFirst: jest.fn().mockResolvedValue({
          ...room,
          hotel: { ...room.hotel, ownerId: owner.id },
        }),
        update: jest.fn(),
      },
      roomPricingRule: { create: jest.fn() },
      roomPricingAudit: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (db: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new PricingService(prisma);
    await expect(
      service.setBase(owner, 'hotel-b', 'room-b', {
        price: '1200000',
        expectedVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.room.update).not.toHaveBeenCalled();
    expect(tx.roomPricingAudit.create).not.toHaveBeenCalled();
  });
});
