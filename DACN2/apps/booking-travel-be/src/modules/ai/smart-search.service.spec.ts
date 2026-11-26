import { AccommodationPreferenceType } from '@prisma/client';
import { HotelsService } from '../hotels/hotels.service';
import { SmartSearchService } from './smart-search.service';

const hotel = {
  id: 'hotel-blue',
  name: 'Blue Hotel',
  addressLine: 'Mỹ Khê',
  city: 'Đà Nẵng',
  district: 'Sơn Trà',
  ward: null,
  province: 'Đà Nẵng',
  description: 'Khách sạn gần biển Mỹ Khê.',
  accommodationType: AccommodationPreferenceType.HOTEL,
  starRating: 4,
  minPricePerNight: '1450000',
  freeCancellation: true,
  amenities: [{ id: 'POOL', name: 'Hồ bơi' }],
};

describe('SmartSearchService', () => {
  const hotels = {
    list: jest.fn(),
    search: jest.fn(),
  };
  const service = new SmartSearchService(hotels as unknown as HotelsService);

  beforeEach(() => {
    jest.clearAllMocks();
    hotels.list.mockResolvedValue([hotel]);
  });

  it('asks for a destination while preserving understood chips', async () => {
    const result = await service.search({ query: '4 sao dưới 2 triệu' });

    expect(result.status).toBe('NEEDS_DESTINATION');
    expect(result.chips).toEqual(
      expect.arrayContaining(['4 sao', 'Dưới 2.000.000 ₫/đêm']),
    );
    expect(result.destinationSuggestions).toContain('Đà Nẵng');
    expect(hotels.search).not.toHaveBeenCalled();
  });

  it('does not return every hotel for an unrelated sentence', async () => {
    const result = await service.search({
      query: 'Hãy giải giúp tôi bài toán lượng giác này',
      destination: 'Đà Nẵng',
    });

    expect(result.status).toBe('UNSUPPORTED_QUERY');
    expect(result.message).toBe(
      'Tôi được cấu hình để tìm kiếm những khách sạn phù hợp cho bạn. Nội dung này nằm ngoài hiểu biết của tôi. Xin cảm ơn.',
    );
    expect(result.items).toEqual([]);
    expect(hotels.search).not.toHaveBeenCalled();
  });

  it('treats administrative city prefixes as the same destination', async () => {
    const result = await service.search({
      query: 'homestay hotel',
      destination: 'Thành phố Đà Nẵng',
    });

    expect(result.status).toBe('RESULTS');
    expect(result.intent.destination).toBe('Đà Nẵng');
    expect(result.intent.propertyTypes).toEqual([
      AccommodationPreferenceType.HOTEL,
      AccommodationPreferenceType.HOMESTAY,
    ]);
    expect(result.items).toEqual([hotel]);
  });

  it('uses the existing stay search and returns only grounded hotels', async () => {
    hotels.search.mockResolvedValue({ items: [hotel] });

    const result = await service.search({
      query: 'Khách sạn 4 sao gần biển dưới 2 triệu',
      destination: 'Đà Nẵng',
      checkIn: '2099-12-10',
      checkOut: '2099-12-13',
      adults: 2,
      children: 0,
      rooms: 1,
    });

    expect(hotels.search).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'Đà Nẵng',
        stars: [4],
        maxPrice: 2_000_000,
      }),
    );
    expect(result.status).toBe('RESULTS');
    expect(result.items).toEqual([hotel]);
  });

  it('keeps prior constraints across a follow-up question', async () => {
    const first = await service.search({
      query: 'Khách sạn 4 sao ở Đà Nẵng dưới 2 triệu',
    });
    const followUp = await service.search({ query: 'có hồ bơi' }, first.intent);

    expect(followUp.intent).toEqual(
      expect.objectContaining({
        destination: 'Đà Nẵng',
        stars: [4],
        maxPrice: 2_000_000,
        amenities: ['Hồ bơi'],
      }),
    );
    expect(followUp.items).toEqual([hotel]);
  });

  it('requires stay dates for a total budget and uses verified stay totals', async () => {
    const withoutDates = await service.search({
      query: 'Đà Nẵng 2 triệu tổng cộng cho 3 đêm',
    });
    expect(withoutDates.status).toBe('NEEDS_DATES');
    expect(hotels.search).not.toHaveBeenCalled();

    hotels.search.mockResolvedValue({
      items: [{ ...hotel, stayPriceFrom: '3000000' }],
    });
    const withDates = await service.search({
      query: 'Đà Nẵng 2 triệu tổng cộng cho 3 đêm',
      checkIn: '2099-12-10',
      checkOut: '2099-12-13',
      rooms: 1,
    });
    expect(withDates.status).toBe('NO_MATCH');
    expect(withDates.items).toEqual([]);
  });
});
