import { SetMetadata } from '@nestjs/common';

export const ALLOW_INACTIVE_SESSION_KEY = 'allowInactiveSession';
export const AllowInactiveSession = () =>
  SetMetadata(ALLOW_INACTIVE_SESSION_KEY, true);
