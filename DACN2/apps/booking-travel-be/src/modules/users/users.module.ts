import { Module } from '@nestjs/common';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TravelPreferencesController } from './travel-preferences.controller';
import { TravelPreferencesService } from './travel-preferences.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [UsersController, TravelPreferencesController],
  providers: [UsersService, TravelPreferencesService],
})
export class UsersModule {}
