import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MediaController } from './media.controller';
import { OwnerCoverController } from './owner-cover.controller';
import { AvatarLocalController } from './avatar-local.controller';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [MediaController, OwnerCoverController, AvatarLocalController],
})
export class MediaModule {}
