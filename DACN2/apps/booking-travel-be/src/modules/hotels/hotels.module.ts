import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [HotelsController],
  providers: [HotelsService],
})
export class HotelsModule {}
