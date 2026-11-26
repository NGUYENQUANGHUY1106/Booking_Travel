import { AccommodationPreferenceType } from '@prisma/client';
import {
  parseSmartSearchIntent,
  smartSearchChips,
  type SmartSearchHotel,
} from './smart-search.intent';

const hotels: SmartSearchHotel[] = [
  {
    name: 'Blue Hotel',
    city: 'Đà Nẵng',
    province: 'Đà Nẵng',
    description: 'Khách sạn gần biển Mỹ Khê.',
    accommodationType: AccommodationPreferenceType.HOTEL,
    starRating: 4,
    minPricePerNight: '1450000',
    freeCancellation: true,
    amenities: [{ name: 'Hồ bơi' }, { name: 'Wi-Fi' }],
  },
];

describe('AI smart-search intent', () => {
  it('maps the SRS acceptance sentence to safe structured filters', () => {
    const intent = parseSmartSearchIntent(
      'Khách sạn 4 sao gần biển dưới 2 triệu',
      hotels,
      'Đà Nẵng',
    );

    expect(intent).toEqual(
      expect.objectContaining({
        confidence: 0.9,
        destination: 'Đà Nẵng',
        stars: [4],
        maxPrice: 2_000_000,
        propertyTypes: [AccommodationPreferenceType.HOTEL],
        features: ['NEAR_BEACH'],
      }),
    );
    expect(smartSearchChips(intent)).toEqual(
      expect.arrayContaining([
        'Điểm đến: Đà Nẵng',
        '4 sao',
        'Dưới 2.000.000 ₫/đêm',
        'Gần biển',
      ]),
    );
  });

  it('maps real destination and amenity names without inventing entities', () => {
    const intent = parseSmartSearchIntent(
      'Tìm ở Đà Nẵng có hồ bơi và wifi',
      hotels,
    );

    expect(intent.destination).toBe('Đà Nẵng');
    expect(intent.amenities).toEqual(['Hồ bơi', 'Wi-Fi']);
  });

  it('understands a decimal price written with a Vietnamese comma', () => {
    expect(
      parseSmartSearchIntent('Đà Nẵng dưới 1,5 triệu', hotels).maxPrice,
    ).toBe(1_500_000);
  });

  it('keeps destination empty when neither the query nor context has one', () => {
    expect(
      parseSmartSearchIntent('4 sao dưới 2 triệu', hotels).destination,
    ).toBeNull();
  });

  it('does not reuse a stale destination when a new unknown place is mentioned', () => {
    expect(
      parseSmartSearchIntent('Đi Phú Quốc dưới 2 triệu', hotels, 'Đà Nẵng')
        .destination,
    ).toBeNull();
  });

  it('marks an unrelated sentence as low confidence even with old search context', () => {
    const intent = parseSmartSearchIntent(
      'Hãy giải giúp tôi bài toán lượng giác này',
      hotels,
      'Đà Nẵng',
    );

    expect(intent.destination).toBe('Đà Nẵng');
    expect(intent.confidence).toBe(0.1);
  });
});
