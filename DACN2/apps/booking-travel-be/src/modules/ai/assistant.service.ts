import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiMessageRole, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AssistantMessageDto } from './dto/assistant-message.dto';
import { AssistantProvider } from './assistant-provider';
import { AssistantRetrievalService } from './assistant-retrieval.service';
import {
  normalizeSmartSearchText,
  type SmartSearchIntent,
} from './smart-search.intent';
import { SmartSearchService } from './smart-search.service';

const GUEST_CONVERSATION_TTL_MS = 24 * 60 * 60 * 1000;
const HOTEL_QUESTION_TERMS = [
  'khach san nay',
  'tien nghi',
  'chinh sach',
  'huy phong',
  'nhan phong',
  'tra phong',
  'dia chi',
];

type StoredContext = {
  intent?: SmartSearchIntent;
  destination?: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  rooms?: number;
  hotelId?: string;
};

type GroundedHotel = {
  id: string;
  name: string;
  addressLine?: string | null;
  city?: string | null;
  province?: string | null;
  description?: string | null;
  accommodationType?: string | null;
  starRating: number;
  minPricePerNight?: string | null;
  currency?: string | null;
  freeCancellation?: boolean;
  updatedAt: Date | string;
  amenities: { id: string; name: string }[];
};

function storedContext(value: Prisma.JsonValue): StoredContext {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function isHotelQuestion(message: string, hotelId?: string) {
  if (!hotelId) return false;
  const text = normalizeSmartSearchText(message);
  return HOTEL_QUESTION_TERMS.some((term) => text.includes(term));
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smartSearch: SmartSearchService,
    private readonly retrieval: AssistantRetrievalService,
    private readonly provider: AssistantProvider,
  ) {}

  async message(input: AssistantMessageDto, user?: AuthenticatedUser) {
    const conversation = await this.resolveConversation(input, user);
    const previous = storedContext(conversation.context);
    const requestContext = {
      ...previous,
      ...Object.fromEntries(
        Object.entries(input.context ?? {}).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    };
    const history = [...conversation.messages].reverse().map((message) => ({
      role:
        message.role === AiMessageRole.USER
          ? ('user' as const)
          : ('assistant' as const),
      content: message.content,
    }));

    const hotelId = requestContext.hotelId;
    const result = isHotelQuestion(input.message, hotelId)
      ? await this.hotelAnswer(hotelId!, input.message, history)
      : await this.searchAnswer(input, requestContext, history);
    const nextContext: StoredContext = {
      ...requestContext,
      ...(result.intent && result.intent.confidence >= 0.5
        ? {
            intent: result.intent,
            destination:
              result.intent.destination ?? requestContext.destination,
          }
        : {}),
    };
    const sources = result.sources as unknown as Prisma.InputJsonValue;

    await this.prisma.$transaction([
      this.prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: AiMessageRole.USER,
          content: input.message.trim(),
        },
      }),
      this.prisma.aiMessage.create({
        data: {
          conversationId: conversation.id,
          role: AiMessageRole.ASSISTANT,
          content: result.answer,
          intent: result.intent
            ? (result.intent as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          sources,
          provider: result.provider.name,
          model: result.provider.model,
        },
      }),
      this.prisma.aiConversation.update({
        where: { id: conversation.id },
        data: { context: nextContext },
      }),
    ]);

    return {
      ...result,
      conversationId: conversation.id,
      guestSessionId: conversation.userId ? null : conversation.guestSessionId,
      dataAsOf: new Date().toISOString(),
    };
  }

  private async resolveConversation(
    input: AssistantMessageDto,
    user?: AuthenticatedUser,
  ) {
    if (input.conversationId) {
      const conversation = await this.prisma.aiConversation.findUnique({
        where: { id: input.conversationId },
        include: { messages: { orderBy: { createdAt: 'desc' }, take: 12 } },
      });
      if (!conversation)
        throw new NotFoundException('Không tìm thấy hội thoại AI.');
      if (conversation.expiresAt && conversation.expiresAt <= new Date())
        throw new NotFoundException('Hội thoại AI đã hết hạn.');
      if (conversation.userId) {
        if (conversation.userId !== user?.id)
          throw new ForbiddenException('Không được xem hội thoại AI này.');
      } else if (
        !input.guestSessionId ||
        input.guestSessionId !== conversation.guestSessionId
      ) {
        throw new ForbiddenException('Guest session không hợp lệ.');
      }

      if (user && input.consentToSave && !conversation.userId) {
        return this.prisma.aiConversation.update({
          where: { id: conversation.id },
          data: { userId: user.id, consentToSave: true, expiresAt: null },
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 12 } },
        });
      }
      return conversation;
    }

    const saveForUser = Boolean(user && input.consentToSave);
    return this.prisma.aiConversation.create({
      data: {
        userId: saveForUser ? user!.id : null,
        guestSessionId: saveForUser
          ? null
          : (input.guestSessionId ?? randomUUID()),
        consentToSave: saveForUser,
        context: (input.context ?? {}) as Prisma.InputJsonValue,
        expiresAt: saveForUser
          ? null
          : new Date(Date.now() + GUEST_CONVERSATION_TTL_MS),
      },
      include: { messages: true },
    });
  }

  private async searchAnswer(
    input: AssistantMessageDto,
    context: StoredContext,
    history: { role: 'user' | 'assistant'; content: string }[],
  ) {
    const search = await this.smartSearch.search(
      {
        query: input.message,
        destination: context.destination,
        checkIn: context.checkIn,
        checkOut: context.checkOut,
        adults: context.adults,
        children: context.children,
        rooms: context.rooms,
        limit: 5,
      },
      context.intent,
    );
    const items = search.items as GroundedHotel[];
    const sources = items.map((hotel) => ({
      type: 'HOTEL' as const,
      id: hotel.id,
      label: hotel.name,
    }));
    const status =
      search.status === 'RESULTS'
        ? ('ANSWER' as const)
        : search.status === 'NEEDS_DESTINATION'
          ? ('NEEDS_CLARIFICATION' as const)
          : search.status;
    const generated = await this.generate(
      input.message,
      search.message,
      history,
      items.map((hotel) =>
        [
          `hotelId=${hotel.id}`,
          `tên=${hotel.name}`,
          `địa chỉ=${[hotel.addressLine, hotel.city, hotel.province].filter(Boolean).join(', ')}`,
          `loại=${hotel.accommodationType ?? 'chưa cập nhật'}`,
          `sao=${hotel.starRating || 'chưa cập nhật'}`,
          `giá từ=${hotel.minPricePerNight ?? 'chưa cập nhật'} ${hotel.currency ?? 'VND'}`,
          `tiện nghi=${hotel.amenities.map((amenity) => amenity.name).join(', ') || 'chưa cập nhật'}`,
        ].join('; '),
      ),
    );

    return {
      status,
      answer: generated.answer,
      intent: search.intent,
      missingFields:
        search.status === 'NEEDS_DESTINATION' ? ['destination'] : [],
      suggestions: sources.map((source) => ({
        type: 'HOTEL' as const,
        hotelId: source.id,
      })),
      sources,
      chips: search.chips,
      destinationSuggestions: search.destinationSuggestions,
      items,
      provider: generated.provider,
    };
  }

  private async hotelAnswer(
    hotelId: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ) {
    const hotel = (await this.retrieval.hotel(hotelId)) as GroundedHotel & {
      checkInTime?: string | null;
      checkOutTime?: string | null;
      policy?: {
        cancellationPolicy?: string | null;
        houseRules?: string | null;
      } | null;
    };
    const draft = [
      `${hotel.name}:`,
      `địa chỉ ${[hotel.addressLine, hotel.city, hotel.province].filter(Boolean).join(', ') || 'chưa cập nhật'}.`,
      `Tiện nghi: ${hotel.amenities.map((amenity) => amenity.name).join(', ') || 'chưa cập nhật'}.`,
      `Nhận phòng ${hotel.checkInTime ?? 'chưa cập nhật'}, trả phòng ${hotel.checkOutTime ?? 'chưa cập nhật'}.`,
      `Chính sách hủy: ${hotel.policy?.cancellationPolicy ?? 'chưa cập nhật'}.`,
    ].join(' ');
    const generated = await this.generate(message, draft, history, [draft]);
    const source = { type: 'HOTEL' as const, id: hotel.id, label: hotel.name };

    return {
      status: 'ANSWER' as const,
      answer: generated.answer,
      intent: null,
      missingFields: [],
      suggestions: [{ type: 'HOTEL' as const, hotelId: hotel.id }],
      sources: [source],
      chips: [],
      destinationSuggestions: [],
      items: [hotel],
      provider: generated.provider,
    };
  }

  private async generate(
    message: string,
    draftAnswer: string,
    history: { role: 'user' | 'assistant'; content: string }[],
    groundedFacts: string[],
  ) {
    if (!this.provider.configured()) {
      return {
        answer: draftAnswer,
        provider: {
          mode: 'DETERMINISTIC' as const,
          name: null,
          model: null,
          status: 'NOT_CONFIGURED' as const,
        },
      };
    }
    try {
      const output = await this.provider.complete({
        message,
        draftAnswer,
        history,
        groundedFacts,
      });
      return {
        answer: output.answer,
        provider: {
          mode: 'LLM' as const,
          name: output.provider,
          model: output.model,
          status: 'OK' as const,
        },
      };
    } catch {
      return {
        answer: draftAnswer,
        provider: {
          mode: 'DETERMINISTIC' as const,
          name: null,
          model: null,
          status: 'FALLBACK' as const,
        },
      };
    }
  }
}
