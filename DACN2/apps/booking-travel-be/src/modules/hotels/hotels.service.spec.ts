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

  it('returns a page and calculates an indicative price for the whole stay', async () => {
    const list = jest.spyOn(service, 'list').mockResolvedValue([
      { id: 'hotel-1', minPricePerNight: '1450000' },
      { id: 'hotel-2', minPricePerNight: '900000' },
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
});
