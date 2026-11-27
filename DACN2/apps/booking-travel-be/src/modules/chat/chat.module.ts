import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { OwnerGuestsController } from './owner-guests.controller';
import { OwnerGuestsService } from './owner-guests.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [ChatController, OwnerGuestsController],
  providers: [ChatService, ChatGateway, OwnerGuestsService],
})
export class ChatModule {}
