import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import configuration from './config/configuration';
import { DatabaseModule } from './infrastructure/database/database.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { AdminModule } from './modules/admin/admin.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { AiModule } from './modules/ai/ai.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ChatModule } from './modules/chat/chat.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { HotelOwnersModule } from './modules/hotel-owners/hotel-owners.module';
import { HotelsModule } from './modules/hotels/hotels.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { TravelModule } from './modules/travel/travel.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env', '../../.env'],
      load: [configuration],
    }),
    DatabaseModule,
    QueueModule,
    StorageModule,
    AuthModule,
    UsersModule,
    HotelOwnersModule,
    HotelsModule,
    RoomsModule,
    AvailabilityModule,
    PricingModule,
    BookingsModule,
    PaymentsModule,
    FavoritesModule,
    ReviewsModule,
    ChatModule,
    NotificationsModule,
    PromotionsModule,
    ReportsModule,
    AnalyticsModule,
    AdminModule,
    AddressesModule,
    AiModule,
    TravelModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
