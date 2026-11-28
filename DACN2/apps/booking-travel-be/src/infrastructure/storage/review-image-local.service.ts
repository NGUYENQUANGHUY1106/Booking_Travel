import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AvatarLocalService } from './avatar-local.service';

@Injectable()
export class ReviewImageLocalService extends AvatarLocalService {
  protected override readonly route = 'review-images';
  protected override readonly keyPattern =
    /^review-images\/([a-z0-9_-]+\/[a-z0-9_-]+)\/([0-9a-f-]{36})\.(jpg|png|webp)$/i;

  constructor(config: ConfigService) {
    super(config);
  }
}
