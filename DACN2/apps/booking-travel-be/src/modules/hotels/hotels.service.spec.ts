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

    expect(list).toHaveBeenCalledWith(
      {
        search: 'Đà Nẵng',
        checkIn: '2099-12-10',
        checkOut: '2099-12-13',
        adults: 4,
        children: 1,
        rooms: 2,
      },
      undefined,
      undefined,
    );
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

describe('HotelsService map search', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;
  const service = new HotelsService(
    prisma,
    {} as AuthorizationService,
    {} as HotelMediaService,
  );

  afterEach(() => jest.restoreAllMocks());

  const query = {
    destination: 'Đà Nẵng',
    checkIn: '2099-12-10',
    checkOut: '2099-12-13',
    adults: 2,
    children: 0,
    rooms: 1,
    northEastLatitude: 16.2,
    northEastLongitude: 108.3,
    southWestLatitude: 15.9,
    southWestLongitude: 108,
    stars: [5],
  };

  it('returns minimal markers inside the PostGIS candidate set and keeps filters', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: 'inside' },
      { id: 'filtered-out-by-bounds' },
    ]);
    const search = jest.spyOn(service, 'search').mockResolvedValue({
      items: [
        {
          id: 'inside',
          name: 'Blue Hotel',
          latitude: '16.05',
          longitude: '108.2',
          starRating: 5,
          accommodationType: 'HOTEL',
          minPricePerNight: '900000',
          stayPriceFrom: '2700000',
          currency: 'VND',
          description: 'must not leak into marker response',
        },
        {
          id: 'outside',
          name: 'Outside Hotel',
          latitude: '10',
          longitude: '106',
          starRating: 5,
          accommodationType: 'HOTEL',
          minPricePerNight: '800000',
          stayPriceFrom: '2400000',
          currency: 'VND',
        },
      ],
    } as never);

    const result = await service.mapSearch(query);

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        destination: 'Đà Nẵng',
        stars: [5],
        page: 1,
      }),
      ['inside', 'filtered-out-by-bounds'],
    );
    expect(result.items).toEqual([
      {
        id: 'inside',
        name: 'Blue Hotel',
        latitude: '16.05',
        longitude: '108.2',
        starRating: 5,
        accommodationType: 'HOTEL',
        minPricePerNight: '900000',
        stayPriceFrom: '2700000',
        currency: 'VND',
      },
    ]);
  });

  it('rejects inverted bounds before querying PostGIS', async () => {
    await expect(
      service.mapSearch({
        ...query,
        northEastLatitude: 15,
        southWestLatitude: 16,
      }),
    ).rejects.toThrow('Phạm vi bản đồ không hợp lệ');
  });
});
