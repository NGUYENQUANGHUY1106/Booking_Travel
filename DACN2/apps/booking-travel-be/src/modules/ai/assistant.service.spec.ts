import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AssistantProvider } from './assistant-provider';
import { AssistantRetrievalService } from './assistant-retrieval.service';
import { AssistantService } from './assistant.service';
import { SmartSearchService } from './smart-search.service';

describe('AssistantService', () => {
  const prisma = {
    aiConversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aiMessage: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const smartSearch = { search: jest.fn() };
  const retrieval = { hotel: jest.fn() };
  const provider = {
    configured: jest.fn().mockReturnValue(false),
    complete: jest.fn(),
  };
  const service = new AssistantService(
    prisma as unknown as PrismaService,
    smartSearch as unknown as SmartSearchService,
    retrieval as unknown as AssistantRetrievalService,
    provider as unknown as AssistantProvider,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    provider.configured.mockReturnValue(false);
  });

  it('creates a guest conversation and returns only grounded search items', async () => {
    prisma.aiConversation.create.mockResolvedValue({
      id: 'conversation-1',
      userId: null,
      guestSessionId: '8db22d80-4eed-47ee-9a65-5945d074d746',
      context: {},
      messages: [],
    });
    prisma.aiMessage.create.mockResolvedValue({});
    prisma.aiConversation.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);
    smartSearch.search.mockResolvedValue({
      status: 'RESULTS',
      message: 'Đã tìm thấy 1 khách sạn phù hợp từ dữ liệu hệ thống.',
      intent: { confidence: 0.9, destination: 'Đà Nẵng' },
      chips: ['Điểm đến: Đà Nẵng'],
      destinationSuggestions: [],
      items: [
        {
          id: 'hotel-1',
          name: 'Khách sạn thật',
          addressLine: 'Mỹ Khê',
          city: 'Đà Nẵng',
          province: 'Đà Nẵng',
          accommodationType: 'HOTEL',
          starRating: 4,
          minPricePerNight: '1200000',
          currency: 'VND',
          amenities: [],
          updatedAt: new Date(),
        },
      ],
    });

    const result = await service.message({ message: 'Khách sạn ở Đà Nẵng' });

    expect(result.answer).toContain('1 khách sạn');
    expect(result.items).toHaveLength(1);
    expect(result.conversationId).toBe('conversation-1');
    expect(result.provider.status).toBe('NOT_CONFIGURED');
  });

  it('prevents one user from reading or continuing another user conversation', async () => {
    prisma.aiConversation.findUnique.mockResolvedValue({
      id: 'conversation-private',
      userId: 'user-a',
      guestSessionId: null,
      expiresAt: null,
      context: {},
      messages: [],
    });

    await expect(
      service.message(
        { message: 'Tiếp tục', conversationId: 'conversation-private' },
        {
          id: 'user-b',
          role: 'USER',
          permissions: [],
          sessionId: 'session-b',
        } as never,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(smartSearch.search).not.toHaveBeenCalled();
  });
});
