import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

const CONVERSATION_SELECT = {
  id: true,
  userId: true,
  ownerId: true,
  hotelId: true,
  createdAt: true,
  updatedAt: true,
  hotel: { select: { id: true, name: true, coverImageUrl: true } },
  user: { select: { id: true, fullName: true, avatarUrl: true } },
  owner: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  senderId: true,
  content: true,
  createdAt: true,
  readAt: true,
  sender: { select: { id: true, fullName: true, avatarUrl: true } },
} as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, input: CreateConversationDto) {
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: input.hotelId,
        deletedAt: null,
        status: HotelStatus.APPROVED,
        isVisible: true,
      },
      select: { id: true, ownerId: true },
    });
    if (!hotel) {
      throw new NotFoundException(
        'Khách sạn không tồn tại hoặc chưa được công khai.',
      );
    }

    return this.prisma.conversation.upsert({
      where: { userId_hotelId: { userId, hotelId: hotel.id } },
      create: { userId, ownerId: hotel.ownerId, hotelId: hotel.id },
      update: { ownerId: hotel.ownerId },
      select: CONVERSATION_SELECT,
    });
  }

  async get(id: string, user: AuthenticatedUser) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: CONVERSATION_SELECT,
    });
    if (!conversation) {
      throw new NotFoundException('Không tìm thấy cuộc trò chuyện.');
    }
    if (conversation.userId !== user.id && conversation.ownerId !== user.id) {
      throw new ForbiddenException('Bạn không thuộc cuộc trò chuyện này.');
    }

    return conversation;
  }

  async listConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ userId }, { ownerId: userId }] },
      orderBy: { updatedAt: 'desc' },
      select: {
        ...CONVERSATION_SELECT,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: MESSAGE_SELECT,
        },
        _count: {
          select: {
            messages: { where: { senderId: { not: userId }, readAt: null } },
          },
        },
      },
    });

    return conversations.map(({ messages, _count, ...conversation }) => ({
      ...conversation,
      lastMessage: messages[0] ?? null,
      unreadCount: _count.messages,
    }));
  }

  async assertParticipant(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, OR: [{ userId }, { ownerId: userId }] },
      select: { id: true },
    });
    if (!conversation) {
      throw new ForbiddenException('Bạn không thuộc cuộc trò chuyện này.');
    }

    return conversation;
  }

  async listMessages(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: MESSAGE_SELECT,
    });

    return messages.reverse();
  }

  async sendMessage(conversationId: string, senderId: string, content: string) {
    await this.assertParticipant(conversationId, senderId);
    const normalizedContent = content.trim();
    if (!normalizedContent || normalizedContent.length > 2000) {
      throw new BadRequestException('Nội dung tin nhắn không hợp lệ.');
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId, content: normalizedContent },
        select: MESSAGE_SELECT,
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);

    return message;
  }

  async markRead(conversationId: string, readerId: string) {
    await this.assertParticipant(conversationId, readerId);
    const readAt = new Date();
    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderId: { not: readerId },
        readAt: null,
        createdAt: { lte: readAt },
      },
      data: { readAt },
    });

    return { conversationId, readerId, readAt, count: result.count };
  }
}
