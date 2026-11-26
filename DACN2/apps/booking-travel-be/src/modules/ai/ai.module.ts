import { forwardRef, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { HotelsModule } from '../hotels/hotels.module';
import { AssistantProvider } from './assistant-provider';
import { AssistantRetrievalService } from './assistant-retrieval.service';
import { AssistantService } from './assistant.service';
import { AiController } from './ai.controller';
import { EmbeddingProvider } from './embedding-provider';
import { HotelEmbeddingQueueService } from './hotel-embedding-queue.service';
import { HotelEmbeddingService } from './hotel-embedding.service';
import { SmartSearchService } from './smart-search.service';

@Module({
  imports: [
    forwardRef(() => HotelsModule),
    AuthModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AiController],
  providers: [
    SmartSearchService,
    AssistantService,
    AssistantProvider,
    AssistantRetrievalService,
    EmbeddingProvider,
    HotelEmbeddingService,
    HotelEmbeddingQueueService,
  ],
  exports: [HotelEmbeddingService, HotelEmbeddingQueueService],
})
export class AiModule {}
