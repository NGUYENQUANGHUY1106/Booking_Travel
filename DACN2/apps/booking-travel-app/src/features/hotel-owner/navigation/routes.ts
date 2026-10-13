import type { Href } from 'expo-router';

import type { OwnerScreenId } from '../types';

export function ownerScreenHref(id: OwnerScreenId): Href {
  return { pathname: '/hotel-owner/screen/[id]', params: { id } } as unknown as Href;
}

export function ownerTabHref(tab?: 'availability' | 'pricing'): Href {
  return (tab ? `/hotel-owner/${tab}` : '/hotel-owner') as Href;
}

