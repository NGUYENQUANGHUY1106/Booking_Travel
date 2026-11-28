import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import {
  PublicReviewsController,
  ReviewsController,
} from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { ReviewImageLocalController } from './review-image-local.controller';

@Module({
  imports: [
    AuthorizationModule,
    StorageModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  controllers: [
    ReviewsController,
    PublicReviewsController,
    ReviewImageLocalController,
  ],
  providers: [ReviewsService],
})
export class ReviewsModule {}
