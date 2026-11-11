import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { HotelsModule } from '../hotels/hotels.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [AuthorizationModule, HotelsModule, PricingModule],
  controllers: [RoomsController, InventoryController],
  providers: [RoomsService, InventoryService],
})
export class RoomsModule {}
