import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { HotelStatus, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const hotelFindFirst = jest.fn();
  const conversationUpsert = jest.fn();
  const conversationFindUnique = jest.fn();
  const prisma = {
    hotel: { findFirst: hotelFindFirst },
    conversation: {
      upsert: conversationUpsert,
      findUnique: conversationFindUnique,
    },
  } as unknown as PrismaService;
  const service = new ChatService(prisma);
  const user: AuthenticatedUser = {
    id: 'user-1',
    role: UserRole.USER,
    permissions: [],
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates or reuses one conversation for the user and hotel', async () => {
    hotelFindFirst.mockResolvedValue({ id: 'hotel-1', ownerId: 'owner-1' });
    conversationUpsert.mockResolvedValue({ id: 'conversation-1' });

    await expect(
      service.create(user.id, { hotelId: 'hotel-1' }),
    ).resolves.toEqual({ id: 'conversation-1' });
    expect(hotelFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'hotel-1',
        deletedAt: null,
        status: HotelStatus.APPROVED,
        isVisible: true,
      },
      select: { id: true, ownerId: true },
    });
    expect(conversationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_hotelId: { userId: user.id, hotelId: 'hotel-1' },
        },
        create: {
          userId: user.id,
          ownerId: 'owner-1',
          hotelId: 'hotel-1',
        },
      }),
    );
  });

  it('rejects a hotel that is unavailable to travelers', async () => {
    hotelFindFirst.mockResolvedValue(null);

    await expect(
      service.create(user.id, { hotelId: 'hotel-hidden' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(conversationUpsert).not.toHaveBeenCalled();
  });

  it('prevents an unrelated account from reading a conversation', async () => {
    conversationFindUnique.mockResolvedValue({
      id: 'conversation-1',
      userId: 'user-1',
      ownerId: 'owner-1',
    });

    await expect(
      service.get('conversation-1', { ...user, id: 'user-2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
