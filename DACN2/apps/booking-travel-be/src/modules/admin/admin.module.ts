import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../common/authorization/authorization.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthorizationModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
