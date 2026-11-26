import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { HotelsModule } from '../hotels/hotels.module';
import { AiController } from './ai.controller';
import { SmartSearchService } from './smart-search.service';

@Module({
  imports: [
    HotelsModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
  ],
  controllers: [AiController],
  providers: [SmartSearchService],
})
export class AiModule {}
