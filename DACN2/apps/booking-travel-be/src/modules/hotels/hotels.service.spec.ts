import { BadRequestException } from '@nestjs/common';
import { HotelsService } from './hotels.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { HotelMediaService } from './hotel-media.service';

describe('HotelsService stay search', () => {
  const service = new HotelsService(
    {} as PrismaService,
    {} as AuthorizationService,
    {} as HotelMediaService,
  );

  afterEach(() => jest.restoreAllMocks());

  const hotel = (
    id: string,
    minPricePerNight: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    minPricePerNight,
    starRating: 4,
    accommodationType: 'HOTEL',
    amenities: [],
    freeCancellation: false,
    reviewScore: null,
    reviewCount: 0,
    ...overrides,
  });

  it('returns a page and calculates an indicative price for the whole stay', async () => {
    const list = jest
      .spyOn(service, 'list')
      .mockResolvedValue([
        hotel('hotel-1', '1450000', { starRating: 5 }),
        hotel('hotel-2', '900000'),
      ] as never);

    const result = await service.search({
      destination: 'Đà Nẵng',
      checkIn: '2099-12-10',
      checkOut: '2099-12-13',
      adults: 4,
      children: 1,
      rooms: 2,
      page: 2,
      limit: 1,
    });

    expect(list).toHaveBeenCalledWith({
      search: 'Đà Nẵng',
      checkIn: '2099-12-10',
      checkOut: '2099-12-13',
      adults: 4,
      children: 1,
      rooms: 2,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        id: 'hotel-2',
        stayNights: 3,
        stayPriceFrom: '5400000',
      }),
    ]);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('combines filters and sorts before applying stable pagination', async () => {
    jest.spyOn(service, 'list').mockResolvedValue([
      hotel('hotel-c', '900000', {
        amenities: [{ id: 'wifi', name: 'Wi-Fi miễn phí' }],
        freeCancellation: true,
      }),
      hotel('hotel-b', '800000', {
        amenities: [{ id: 'wifi', name: 'Wi-Fi miễn phí' }],
        freeCancellation: true,
      }),
      hotel('hotel-a', '700000', {
        accommodationType: 'HOMESTAY',
        amenities: [{ id: 'wifi', name: 'Wi-Fi miễn phí' }],
        freeCancellation: true,
      }),
    ] as never);

    const result = await service.search({
      destination: 'Đà Nẵng',
      checkIn: '2099-12-10',
      checkOut: '2099-12-13',
      adults: 2,
      children: 0,
      rooms: 1,
      maxPrice: 1_000_000,
      stars: [4],
      propertyTypes: ['HOTEL'],
      amenities: ['wi-fi miễn phí'],
      freeCancellation: true,
      sort: 'priceAsc',
      page: 1,
      limit: 1,
    });

    expect(result.items.map((item) => item.id)).toEqual(['hotel-b']);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(result.facets.propertyTypes).toEqual([
      { value: 'HOMESTAY', count: 1 },
      { value: 'HOTEL', count: 2 },
    ]);
  });

  it('does not invent review scores when review aggregates are unavailable', async () => {
    jest
      .spyOn(service, 'list')
      .mockResolvedValue([hotel('hotel-1', '900000')] as never);

    const result = await service.search({
      destination: 'Đà Nẵng',
      checkIn: '2099-12-10',
      checkOut: '2099-12-13',
      adults: 2,
      children: 0,
      rooms: 1,
      minReviewScore: 8,
    });

    expect(result.items).toEqual([]);
    expect(result.facets.reviewScoreAvailable).toBe(0);
  });

  it('rejects a checkout date that is not after check-in', async () => {
    await expect(
      service.search({
        destination: 'Đà Nẵng',
        checkIn: '2099-12-13',
        checkOut: '2099-12-13',
        adults: 2,
        children: 0,
        rooms: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inverted price range', async () => {
    await expect(
      service.search({
        destination: 'Đà Nẵng',
        checkIn: '2099-12-10',
        checkOut: '2099-12-13',
        adults: 2,
        children: 0,
        rooms: 1,
        minPrice: 2_000_000,
        maxPrice: 1_000_000,
      }),
    ).rejects.toThrow('Giá tối thiểu không được lớn hơn giá tối đa.');
  });
});
