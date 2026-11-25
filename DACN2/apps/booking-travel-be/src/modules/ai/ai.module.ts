import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { HotelsModule } from '../hotels/hotels.module';
import { AssistantProvider } from './assistant-provider';
import { AssistantRetrievalService } from './assistant-retrieval.service';
import { AssistantService } from './assistant.service';
import { AiController } from './ai.controller';
import { SmartSearchService } from './smart-search.service';

@Module({
  imports: [
    HotelsModule,
    AuthModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AiController],
  providers: [
    SmartSearchService,
    AssistantService,
    AssistantProvider,
    AssistantRetrievalService,
  ],
})
export class AiModule {}
