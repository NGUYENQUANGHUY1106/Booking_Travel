import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { HotelStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  const prisma = {
    wishlist: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    hotel: { findFirst: jest.fn() },
    favorite: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
  let service: FavoritesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FavoritesService(prisma as unknown as PrismaService);
  });

  it('saves the same hotel idempotently with an upsert', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({
      id: 'list-1',
      isDefault: true,
    });
    prisma.hotel.findFirst.mockResolvedValue({
      id: 'hotel-1',
      status: HotelStatus.APPROVED,
    });
    prisma.favorite.upsert.mockResolvedValue({
      id: 'favorite-1',
      wishlistId: 'list-1',
      hotelId: 'hotel-1',
    });

    await service.save('user-1', 'list-1', 'hotel-1');
    await service.save('user-1', 'list-1', 'hotel-1');

    expect(prisma.favorite.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.favorite.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          wishlistId_hotelId: { wishlistId: 'list-1', hotelId: 'hotel-1' },
        },
      }),
    );
  });

  it('does not expose or modify another user wishlist', async () => {
    prisma.wishlist.findFirst.mockResolvedValue(null);

    await expect(
      service.rename('user-2', 'list-1', 'Du lịch hè'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.save('user-2', 'list-1', 'hotel-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.hotel.findFirst).not.toHaveBeenCalled();
    expect(prisma.favorite.upsert).not.toHaveBeenCalled();
  });

  it('removes a hotel idempotently only from an owned wishlist', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({
      id: 'list-1',
      isDefault: false,
    });
    prisma.favorite.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.unsave('user-1', 'list-1', 'hotel-1'),
    ).resolves.toEqual({ saved: false });
    await expect(
      service.unsave('user-1', 'list-1', 'hotel-1'),
    ).resolves.toEqual({ saved: false });
    expect(prisma.favorite.deleteMany).toHaveBeenCalledTimes(2);
  });

  it('protects the default wishlist from rename and deletion', async () => {
    prisma.wishlist.findFirst.mockResolvedValue({
      id: 'default-1',
      isDefault: true,
    });

    await expect(
      service.rename('user-1', 'default-1', 'Khác'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.removeList('user-1', 'default-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
