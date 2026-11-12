import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HotelStaySearchQueryDto } from './hotel-stay-search-query.dto';

const REQUIRED_QUERY = {
  destination: 'Đà Nẵng',
  checkIn: '2099-12-10',
  checkOut: '2099-12-13',
  adults: '2',
  children: '0',
  rooms: '1',
};

describe('HotelStaySearchQueryDto', () => {
  it('transforms validated CSV filters from query parameters', async () => {
    const query = plainToInstance(HotelStaySearchQueryDto, {
      ...REQUIRED_QUERY,
      stars: '4,5',
      propertyTypes: 'HOTEL,HOMESTAY',
      amenities: 'Hồ bơi,Wi-Fi miễn phí',
      freeCancellation: 'true',
      sort: 'priceAsc',
    });

    expect(await validate(query)).toEqual([]);
    expect(query.stars).toEqual([4, 5]);
    expect(query.propertyTypes).toEqual(['HOTEL', 'HOMESTAY']);
    expect(query.amenities).toEqual(['Hồ bơi', 'Wi-Fi miễn phí']);
    expect(query.freeCancellation).toBe(true);
  });

  it('rejects unknown property types, stars and sort modes', async () => {
    const query = plainToInstance(HotelStaySearchQueryDto, {
      ...REQUIRED_QUERY,
      stars: '0,6',
      propertyTypes: 'MOTEL',
      sort: 'nearest',
    });

    const properties = (await validate(query)).map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['stars', 'propertyTypes', 'sort']),
    );
  });
});
