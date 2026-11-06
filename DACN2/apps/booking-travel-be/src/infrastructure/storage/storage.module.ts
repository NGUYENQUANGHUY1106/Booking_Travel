import { Module } from '@nestjs/common';
import { PrivateMediaService } from './private-media.service';
import { StorageService } from './storage.service';
import { OwnerCoverLocalService } from './owner-cover-local.service';

@Module({
  providers: [PrivateMediaService, StorageService, OwnerCoverLocalService],
  exports: [PrivateMediaService, StorageService, OwnerCoverLocalService],
})
export class StorageModule {}
