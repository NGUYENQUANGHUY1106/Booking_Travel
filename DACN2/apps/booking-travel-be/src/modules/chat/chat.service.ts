import {
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
}
