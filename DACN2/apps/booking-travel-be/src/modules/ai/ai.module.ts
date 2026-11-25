import { Module } from '@nestjs/common';
import { EmbeddingProvider } from './embedding-provider';
import { HotelEmbeddingService } from './hotel-embedding.service';
import { HotelEmbeddingQueueService } from './hotel-embedding-queue.service';

@Module({
  providers: [
    EmbeddingProvider,
    HotelEmbeddingService,
    HotelEmbeddingQueueService,
  ],
  exports: [HotelEmbeddingService, HotelEmbeddingQueueService],
})
export class AiModule {}
