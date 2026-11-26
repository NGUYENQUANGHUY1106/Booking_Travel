import { AccommodationPreferenceType } from '@prisma/client';

export type SmartSearchHotel = {
  name: string;
  addressLine?: string | null;
  city?: string | null;
  district?: string | null;
  ward?: string | null;
  province?: string | null;
  description?: string | null;
  accommodationType?: AccommodationPreferenceType | null;
  starRating: number;
  minPricePerNight: string | null;
  freeCancellation: boolean;
  amenities: { name: string }[];
};

export type SmartSearchIntent = {
  confidence: number;
  destination: string | null;
  stars: number[];
  minPrice: number | null;
  maxPrice: number | null;
  propertyTypes: AccommodationPreferenceType[];
  amenities: string[];
  freeCancellation: boolean;
  features: 'NEAR_BEACH'[];
};

const PROPERTY_TYPE_ALIASES: [AccommodationPreferenceType, string[]][] = [
  [AccommodationPreferenceType.HOTEL, ['khach san', 'hotel']],
  [AccommodationPreferenceType.RESORT, ['resort', 'khu nghi duong']],
  [AccommodationPreferenceType.HOMESTAY, ['homestay']],
  [AccommodationPreferenceType.VILLA, ['villa', 'biet thu']],
  [AccommodationPreferenceType.APARTMENT, ['can ho', 'apartment']],
  [AccommodationPreferenceType.HOSTEL, ['hostel', 'nha nghi']],
];

const AMENITY_ALIASES: Record<string, string[]> = {
  'Hồ bơi': ['ho boi', 'pool'],
  'Wi-Fi': ['wifi', 'wi fi'],
  'Bữa sáng': ['bua sang', 'an sang'],
  'Bãi đỗ xe': ['bai do xe', 'cho do xe', 'parking'],
  'Nhà hàng': ['nha hang'],
  'Phòng gym': ['phong gym', 'gym'],
  Spa: ['spa'],
  'Đưa đón sân bay': ['dua don san bay'],
};

export function normalizeSmartSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('vi-VN')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9.,]+/g, ' ')
    .trim();
}

function destinationLabel(value: string) {
  return value.trim().replace(/^(?:thành phố|tỉnh)\s+/iu, '');
}

export function normalizeSmartSearchLocation(value: string) {
  return normalizeSmartSearchText(destinationLabel(value));
}

function parseMoney(raw: string, unit?: string) {
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value)) return null;
  if (unit?.startsWith('tr')) return Math.round(value * 1_000_000);
  if (unit === 'k' || unit?.startsWith('nghin'))
    return Math.round(value * 1_000);
  return Math.round(value);
}

function priceAfter(text: string, words: string[]) {
  const prefix = words.join('|');
  const match = text.match(
    new RegExp(
      `(?:${prefix})\\s*(\\d+(?:[.,]\\d+)?)\\s*(trieu|tr|nghin|k|dong|vnd)?\\b`,
    ),
  );
  return match ? parseMoney(match[1], match[2]) : null;
}

function availableAmenity(label: string, available: Map<string, string>) {
  const normalizedLabel = normalizeSmartSearchText(label);
  return (
    available.get(normalizedLabel) ??
    [...available].find(
      ([key]) => key.includes(normalizedLabel) || normalizedLabel.includes(key),
    )?.[1]
  );
}

export function parseSmartSearchIntent(
  query: string,
  hotels: readonly SmartSearchHotel[],
  currentDestination?: string,
): SmartSearchIntent {
  const text = normalizeSmartSearchText(query);
  const destinations = new Map<string, string>();
  const amenities = new Map<string, string>();
  for (const hotel of hotels) {
    for (const value of [
      hotel.city,
      hotel.district,
      hotel.ward,
      hotel.province,
    ]) {
      if (value?.trim())
        destinations.set(
          normalizeSmartSearchLocation(value),
          destinationLabel(value),
        );
    }
    for (const amenity of hotel.amenities) {
      amenities.set(normalizeSmartSearchText(amenity.name), amenity.name);
    }
  }

  const mentionedDestination = [...destinations]
    .filter(([key]) => key && text.includes(key))
    .sort(([left], [right]) => right.length - left.length)[0]?.[1];
  const mentionsAnotherLocation =
    /\b(?:o|tai|di|den)\s+(?!(?:gan|sat|cach)\b)[a-z]/.test(text);
  const destination =
    mentionedDestination ??
    (mentionsAnotherLocation
      ? null
      : currentDestination?.trim()
        ? (destinations.get(normalizeSmartSearchLocation(currentDestination)) ??
          destinationLabel(currentDestination))
        : null) ??
    null;
  const star = text.match(/\b([1-5])\s*sao\b/);
  const minPrice = priceAfter(text, ['tu', 'tren', 'toi thieu', 'it nhat']);
  const maxPrice = priceAfter(text, [
    'duoi',
    'toi da',
    'khong qua',
    'ngan sach',
    'khoang',
  ]);
  const propertyTypes = PROPERTY_TYPE_ALIASES.filter(([, aliases]) =>
    aliases.some((alias) => text.includes(alias)),
  ).map(([type]) => type);
  const requestedAmenities = Object.entries(AMENITY_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => text.includes(alias)))
    .map(([label]) => availableAmenity(label, amenities))
    .filter((value): value is string => Boolean(value));
  const freeCancellation =
    text.includes('huy mien phi') || text.includes('mien phi huy');
  const features: SmartSearchIntent['features'] =
    text.includes('gan bien') || text.includes('sat bien')
      ? ['NEAR_BEACH']
      : [];
  const recognizedFields = [
    mentionedDestination,
    star,
    minPrice,
    maxPrice,
    propertyTypes.length,
    requestedAmenities.length,
    freeCancellation,
    features.length,
  ].filter(Boolean).length;

  return {
    confidence:
      recognizedFields >= 2 ? 0.9 : recognizedFields === 1 ? 0.7 : 0.1,
    destination,
    stars: star ? [Number(star[1])] : [],
    minPrice,
    maxPrice,
    propertyTypes,
    amenities: [...new Set(requestedAmenities)],
    freeCancellation,
    features,
  };
}

export function smartSearchChips(intent: SmartSearchIntent) {
  return [
    intent.destination ? `Điểm đến: ${intent.destination}` : null,
    intent.stars.length ? `${intent.stars.join(', ')} sao` : null,
    intent.minPrice !== null
      ? `Từ ${intent.minPrice.toLocaleString('vi-VN')} ₫/đêm`
      : null,
    intent.maxPrice !== null
      ? `Dưới ${intent.maxPrice.toLocaleString('vi-VN')} ₫/đêm`
      : null,
    ...intent.propertyTypes.map((type) => `Loại: ${type}`),
    ...intent.amenities.map((amenity) => `Tiện nghi: ${amenity}`),
    intent.freeCancellation ? 'Hủy miễn phí' : null,
    intent.features.includes('NEAR_BEACH') ? 'Gần biển' : null,
  ].filter((chip): chip is string => Boolean(chip));
}

export function matchesSmartSearchFeature(
  hotel: SmartSearchHotel,
  feature: SmartSearchIntent['features'][number],
) {
  const source = normalizeSmartSearchText(
    [
      hotel.name,
      hotel.addressLine,
      hotel.city,
      hotel.district,
      hotel.ward,
      hotel.province,
      hotel.description,
      ...hotel.amenities.map((amenity) => amenity.name),
    ]
      .filter(Boolean)
      .join(' '),
  );
  return feature === 'NEAR_BEACH'
    ? ['gan bien', 'sat bien', 'bai bien', 'view bien', 'beach'].some((term) =>
        source.includes(term),
      )
    : true;
}
