import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import {
  AdminOwnerApplicationsController,
  OwnerApplicationsController,
} from './owner-applications.controller';
import { OwnerApplicationsService } from './owner-applications.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [OwnerApplicationsController, AdminOwnerApplicationsController],
  providers: [OwnerApplicationsService],
})
export class HotelOwnersModule {}
