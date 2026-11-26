import { forwardRef, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { HotelsModule } from '../hotels/hotels.module';
import { AiController } from './ai.controller';
import { EmbeddingProvider } from './embedding-provider';
import { HotelEmbeddingQueueService } from './hotel-embedding-queue.service';
import { HotelEmbeddingService } from './hotel-embedding.service';
import { SmartSearchService } from './smart-search.service';

@Module({
  imports: [
    forwardRef(() => HotelsModule),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AiController],
  providers: [
    SmartSearchService,
    EmbeddingProvider,
    HotelEmbeddingService,
    HotelEmbeddingQueueService,
  ],
  exports: [HotelEmbeddingService, HotelEmbeddingQueueService],
})
export class AiModule {}
