import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
