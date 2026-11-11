import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
