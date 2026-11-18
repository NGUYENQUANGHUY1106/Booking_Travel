export const NEARBY_PLACE_CATEGORIES = [
  'ATTRACTION',
  'BEACH',
  'FOOD',
  'SHOPPING',
  'TRANSPORT',
  'HEALTHCARE',
  'EDUCATION',
] as const;

export type NearbyPlaceCategory = (typeof NEARBY_PLACE_CATEGORIES)[number];

export const NEARBY_PLACE_CATEGORY_LABELS: Record<NearbyPlaceCategory, string> =
  {
    ATTRACTION: 'Tham quan',
    BEACH: 'Bãi biển',
    FOOD: 'Ăn uống',
    SHOPPING: 'Mua sắm',
    TRANSPORT: 'Giao thông',
    HEALTHCARE: 'Y tế',
    EDUCATION: 'Giáo dục',
  };

export type ProviderNearbyPlace = {
  providerPlaceId: string;
  name: string;
  category: NearbyPlaceCategory;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  sourceUrl: string;
};
