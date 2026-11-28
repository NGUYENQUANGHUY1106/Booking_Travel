import { Module } from '@nestjs/common';
import { PrivateMediaService } from './private-media.service';
import { StorageService } from './storage.service';
import { OwnerCoverLocalService } from './owner-cover-local.service';
import { AvatarLocalService } from './avatar-local.service';
import { ReviewImageLocalService } from './review-image-local.service';

@Module({
  providers: [
    PrivateMediaService,
    StorageService,
    OwnerCoverLocalService,
    AvatarLocalService,
    ReviewImageLocalService,
  ],
  exports: [
    PrivateMediaService,
    StorageService,
    OwnerCoverLocalService,
    AvatarLocalService,
    ReviewImageLocalService,
  ],
})
export class StorageModule {}
