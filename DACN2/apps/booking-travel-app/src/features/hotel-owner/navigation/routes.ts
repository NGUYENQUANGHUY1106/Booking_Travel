import type { Href } from 'expo-router';

import type { OwnerScreenId } from '../types';

export function ownerScreenHref(id: OwnerScreenId, hotelId?: string): Href {
  return { pathname: '/hotel-owner/screen/[id]', params: { id, ...(hotelId ? { hotelId } : {}) } } as unknown as Href;
}

export function ownerRoomHref(hotelId: string, roomId?: string, returnTo: 'hotel-review' | 'rooms' = 'rooms'): Href {
  return {
    pathname: '/hotel-owner/screen/[id]',
    params: { id: 'room-edit', hotelId, returnTo, ...(roomId ? { roomId } : {}) },
  } as unknown as Href;
}

export function ownerTabHref(tab?: 'availability' | 'pricing'): Href {
  return (tab ? `/hotel-owner/${tab}` : '/hotel-owner') as Href;
}

