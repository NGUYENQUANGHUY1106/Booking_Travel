import { SetMetadata } from '@nestjs/common';

export type OwnedResourcePolicy =
  | { resource: 'hotel'; param: string }
  | { resource: 'room'; param: string }
  | { resource: 'booking'; param: string; action: 'read' | 'manage' };

export const OWNED_RESOURCE_KEY = 'ownedResource';
export const OwnedResource = (policy: OwnedResourcePolicy) =>
  SetMetadata(OWNED_RESOURCE_KEY, policy);
