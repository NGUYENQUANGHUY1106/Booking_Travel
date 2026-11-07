import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { OwnerHotelsController } from './owner-hotels.controller';
import { HotelMediaController } from './hotel-media.controller';
import { HotelMediaService } from './hotel-media.service';
import { OwnerHotelWizardService } from './owner-hotel-wizard.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [HotelsController, OwnerHotelsController, HotelMediaController],
  providers: [HotelsService, HotelMediaService, OwnerHotelWizardService],
  exports: [HotelMediaService],
})
export class HotelsModule {}
