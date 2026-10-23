import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MediaController } from './media.controller';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [MediaController],
})
export class MediaModule {}
