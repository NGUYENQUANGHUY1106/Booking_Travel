import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TravelPreferencesController } from './travel-preferences.controller';
import { TravelHistoryController } from './travel-history.controller';
import { TravelHistoryService } from './travel-history.service';
import { TravelPreferencesService } from './travel-preferences.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [
    UsersController,
    TravelPreferencesController,
    TravelHistoryController,
  ],
  providers: [UsersService, TravelPreferencesService, TravelHistoryService],
})
export class UsersModule {}
