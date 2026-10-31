import { Module } from '@nestjs/common';
import { PrivateMediaService } from './private-media.service';
import { StorageService } from './storage.service';

@Module({
  providers: [PrivateMediaService, StorageService],
  exports: [PrivateMediaService, StorageService],
})
export class StorageModule {}
