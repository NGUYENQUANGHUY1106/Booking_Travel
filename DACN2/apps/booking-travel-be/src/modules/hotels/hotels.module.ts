import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { OwnerHotelsController } from './owner-hotels.controller';
import { HotelMediaController } from './hotel-media.controller';
import { HotelMediaService } from './hotel-media.service';
import { OwnerHotelWizardService } from './owner-hotel-wizard.service';
import { HotelModerationService } from './hotel-moderation.service';
import { AdminHotelManagementController } from './admin-hotel-management.controller';
import { AdminHotelManagementService } from './admin-hotel-management.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [
    HotelsController,
    OwnerHotelsController,
    HotelMediaController,
    AdminHotelManagementController,
  ],
  providers: [
    HotelsService,
    HotelMediaService,
    OwnerHotelWizardService,
    HotelModerationService,
    AdminHotelManagementService,
  ],
  exports: [HotelMediaService],
})
export class HotelsModule {}
