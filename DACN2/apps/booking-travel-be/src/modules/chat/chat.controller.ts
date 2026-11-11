import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ChatService } from './chat.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@ApiTags('Chat')
@UseGuards(AccessTokenGuard, RolesGuard)
@Controller('conversations')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  @Roles(UserRole.USER)
  create(
    @Body() input: CreateConversationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.chat.create(user.id, input);
  }

  @Get(':id')
  @Roles(UserRole.USER, UserRole.HOTEL_OWNER)
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.chat.get(id, user);
  }
}
