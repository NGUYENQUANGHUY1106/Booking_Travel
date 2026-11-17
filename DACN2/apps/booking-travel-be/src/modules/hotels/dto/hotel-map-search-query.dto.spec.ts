import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HotelMapSearchQueryDto } from './hotel-map-search-query.dto';

const QUERY = {
  destination: 'Đà Nẵng',
  checkIn: '2099-12-10',
  checkOut: '2099-12-13',
  adults: '2',
  children: '0',
  rooms: '1',
  northEastLatitude: '16.2',
  northEastLongitude: '108.3',
  southWestLatitude: '15.9',
  southWestLongitude: '108.0',
};

describe('HotelMapSearchQueryDto', () => {
  it('transforms valid bounding-box coordinates', async () => {
    const query = plainToInstance(HotelMapSearchQueryDto, QUERY);

    expect(await validate(query)).toEqual([]);
    expect(query.northEastLatitude).toBe(16.2);
    expect(query.southWestLongitude).toBe(108);
  });

  it('rejects coordinates outside latitude and longitude limits', async () => {
    const query = plainToInstance(HotelMapSearchQueryDto, {
      ...QUERY,
      northEastLatitude: '91',
      southWestLongitude: '-181',
    });

    const properties = (await validate(query)).map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['northEastLatitude', 'southWestLongitude']),
    );
  });
});
