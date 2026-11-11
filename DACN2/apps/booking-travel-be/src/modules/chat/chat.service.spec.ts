import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { HotelStatus, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  const hotelFindFirst = jest.fn();
  const conversationUpsert = jest.fn();
  const conversationFindUnique = jest.fn();
  const conversationFindFirst = jest.fn();
  const conversationUpdate = jest.fn();
  const messageFindMany = jest.fn();
  const messageCreate = jest.fn();
  const transaction = jest.fn((queries: Promise<unknown>[]) =>
    Promise.all(queries),
  );
  const prisma = {
    hotel: { findFirst: hotelFindFirst },
    conversation: {
      upsert: conversationUpsert,
      findUnique: conversationFindUnique,
      findFirst: conversationFindFirst,
      update: conversationUpdate,
    },
    message: { findMany: messageFindMany, create: messageCreate },
    $transaction: transaction,
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

  it('returns the latest messages in chronological order', async () => {
    conversationFindFirst.mockResolvedValue({ id: 'conversation-1' });
    messageFindMany.mockResolvedValue([
      { id: 'message-2', content: 'Hai' },
      { id: 'message-1', content: 'Một' },
    ]);

    await expect(
      service.listMessages('conversation-1', user.id),
    ).resolves.toEqual([
      { id: 'message-1', content: 'Một' },
      { id: 'message-2', content: 'Hai' },
    ]);
    expect(messageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { conversationId: 'conversation-1' },
        take: 100,
      }),
    );
  });

  it('persists a trimmed message only for a participant', async () => {
    conversationFindFirst.mockResolvedValue({ id: 'conversation-1' });
    messageCreate.mockResolvedValue({ id: 'message-1', content: 'Xin chào' });
    conversationUpdate.mockResolvedValue({ id: 'conversation-1' });

    await expect(
      service.sendMessage('conversation-1', user.id, '  Xin chào  '),
    ).resolves.toEqual({ id: 'message-1', content: 'Xin chào' });
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          conversationId: 'conversation-1',
          senderId: user.id,
          content: 'Xin chào',
        },
      }),
    );
  });

  it('prevents an unrelated account from sending a message', async () => {
    conversationFindFirst.mockResolvedValue(null);

    await expect(
      service.sendMessage('conversation-1', 'user-2', 'Xin chào'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageCreate).not.toHaveBeenCalled();
  });
});
