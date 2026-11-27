import { NotFoundException } from '@nestjs/common';
import { HotelStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OwnerGuestsService } from './owner-guests.service';

describe('OwnerGuestsService ownership', () => {
  const hotelFindFirst = jest.fn();
  const bookingCount = jest.fn();
  const bookingFindMany = jest.fn();
  const bookingFindFirst = jest.fn();
  const conversationFindUnique = jest.fn();
  const conversationUpsert = jest.fn();
  const conversationUpdate = jest.fn();
  const userFindUnique = jest.fn();
  const queryRaw = jest.fn();
  const service = new OwnerGuestsService({
    hotel: { findFirst: hotelFindFirst },
    booking: {
      count: bookingCount,
      findMany: bookingFindMany,
      findFirst: bookingFindFirst,
    },
    conversation: {
      findUnique: conversationFindUnique,
      upsert: conversationUpsert,
      update: conversationUpdate,
    },
    user: { findUnique: userFindUnique },
    $queryRaw: queryRaw,
  } as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('rejects another owner hotel before querying a guest list or detail', async () => {
    hotelFindFirst.mockResolvedValue(null);
    await expect(
      service.list('owner-a', { hotelId: 'hotel-b' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.detail('owner-a', 'hotel-b', 'user-x'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.openConversation('owner-a', 'hotel-b', 'user-x'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(queryRaw).not.toHaveBeenCalled();
    expect(bookingCount).not.toHaveBeenCalled();
    expect(conversationUpsert).not.toHaveBeenCalled();
  });

  it('queries a guest booking history only inside the authorized hotel', async () => {
    hotelFindFirst.mockResolvedValue({
      id: 'hotel-a',
      name: 'A',
      status: HotelStatus.APPROVED,
      isVisible: true,
    });
    bookingCount.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    conversationFindUnique.mockResolvedValue({ id: 'thread-a' });
    userFindUnique.mockResolvedValue({ id: 'user-x', fullName: 'X' });
    bookingFindMany.mockResolvedValue([{ id: 'booking-a' }]);
    const result = await service.detail('owner-a', 'hotel-a', 'user-x');
    expect(result.bookings).toEqual([{ id: 'booking-a' }]);
    expect(bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { hotelId: 'hotel-a', userId: 'user-x' },
      }),
    );
    expect(bookingCount).toHaveBeenCalledWith({
      where: { hotelId: 'hotel-a', userId: 'user-x' },
    });
  });

  it('reuses a conversation and does not create one for a chat-only contact', async () => {
    hotelFindFirst.mockResolvedValue({
      id: 'hotel-a',
      status: HotelStatus.APPROVED,
      isVisible: true,
    });
    conversationFindUnique.mockResolvedValue({
      id: 'thread-a',
      ownerId: 'owner-a',
    });
    await expect(
      service.openConversation('owner-a', 'hotel-a', 'user-y'),
    ).resolves.toEqual({ id: 'thread-a' });
    expect(bookingFindFirst).not.toHaveBeenCalled();
    expect(conversationUpsert).not.toHaveBeenCalled();
  });

  it('assigns an existing thread to the current hotel owner after ownership changes', async () => {
    hotelFindFirst.mockResolvedValue({
      id: 'hotel-a',
      status: HotelStatus.APPROVED,
      isVisible: true,
    });
    conversationFindUnique.mockResolvedValue({
      id: 'thread-a',
      ownerId: 'former-owner',
    });
    conversationUpdate.mockResolvedValue({ id: 'thread-a' });
    await expect(
      service.openConversation('owner-a', 'hotel-a', 'user-y'),
    ).resolves.toEqual({ id: 'thread-a' });
    expect(conversationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'thread-a' },
        data: { ownerId: 'owner-a' },
      }),
    );
  });

  it('does not create a thread for a user without a confirmed booking', async () => {
    hotelFindFirst.mockResolvedValue({
      id: 'hotel-a',
      status: HotelStatus.APPROVED,
      isVisible: true,
    });
    conversationFindUnique.mockResolvedValue(null);
    bookingFindFirst.mockResolvedValue(null);
    await expect(
      service.openConversation('owner-a', 'hotel-a', 'user-y'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(conversationUpsert).not.toHaveBeenCalled();
  });
});
