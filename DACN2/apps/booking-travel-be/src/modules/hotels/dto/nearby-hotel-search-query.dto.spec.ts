import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NearbyHotelSearchQueryDto } from './nearby-hotel-search-query.dto';

const STAY = {
  checkIn: '2099-12-10',
  checkOut: '2099-12-13',
  adults: '2',
  children: '0',
  rooms: '1',
};

describe('NearbyHotelSearchQueryDto', () => {
  it('accepts coordinates and transforms numeric query values', async () => {
    const query = plainToInstance(NearbyHotelSearchQueryDto, {
      ...STAY,
      latitude: '16.0611',
      longitude: '108.2277',
      radiusKm: '5',
      nearbySort: 'distance',
    });

    expect(await validate(query)).toEqual([]);
    expect(query).toEqual(
      expect.objectContaining({
        latitude: 16.0611,
        longitude: 108.2277,
        radiusKm: 5,
      }),
    );
  });

  it('accepts a manual landmark without coordinates', async () => {
    const query = plainToInstance(NearbyHotelSearchQueryDto, {
      ...STAY,
      landmark: '  Cầu Rồng Đà Nẵng  ',
      radiusKm: '10',
    });

    expect(await validate(query)).toEqual([]);
    expect(query.landmark).toBe('Cầu Rồng Đà Nẵng');
  });

  it('rejects an excessive radius and unknown sort mode', async () => {
    const query = plainToInstance(NearbyHotelSearchQueryDto, {
      ...STAY,
      landmark: 'Hội An',
      radiusKm: '100',
      nearbySort: 'price',
    });

    const properties = (await validate(query)).map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['radiusKm', 'nearbySort']),
    );
  });
});
