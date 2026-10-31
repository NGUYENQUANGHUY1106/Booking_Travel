import { Module } from '@nestjs/common';
import { PrivateMediaService } from './private-media.service';

@Module({ providers: [PrivateMediaService], exports: [PrivateMediaService] })
export class StorageModule {}
