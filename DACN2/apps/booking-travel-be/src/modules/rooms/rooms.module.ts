import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [RoomsController],
  providers: [RoomsService],
})
export class RoomsModule {}
