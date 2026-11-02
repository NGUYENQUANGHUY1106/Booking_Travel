import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { OwnerHotelsController } from './owner-hotels.controller';

@Module({
  imports: [AuthorizationModule],
  controllers: [HotelsController, OwnerHotelsController],
  providers: [HotelsService],
})
export class HotelsModule {}
