import { UserRole } from '@prisma/client';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import type { HotelsService } from '../hotels/hotels.service';
import { HotelRecommendationsService } from './hotel-recommendations.service';

describe('HotelRecommendationsService', () => {
  const preferred = {
    id: 'preferred',
    minPricePerNight: '500000',
    currency: 'VND',
    amenities: [
      { id: 'pool', name: 'Hồ bơi' },
      { id: 'beach', name: 'Giáp biển' },
    ],
    reviewScore: 7,
    reviewCount: 12,
  };
  const topRated = {
    id: 'top-rated',
    minPricePerNight: '1800000',
    currency: 'VND',
    amenities: [],
    reviewScore: 9,
    reviewCount: 40,
  };
  const actor = { id: 'test-user', role: UserRole.USER, permissions: [] };

  function setup() {
    const list = jest.fn().mockResolvedValue([topRated, preferred]);
    const findUnique = jest.fn().mockResolvedValue({
      budgetMin: null,
      budgetMax: 700000,
      currency: 'VND',
      accommodationTypes: [],
      preferredAmenities: ['POOL'],
      preferredAreas: ['BEACHFRONT'],
      tripTypes: [],
    });
    const service = new HotelRecommendationsService(
      { userPreference: { findUnique } } as unknown as PrismaService,
      { list } as unknown as HotelsService,
    );
    return { service, list, findUnique };
  }

  it('selects the best-rated hotel for a guest without fetching preferences', async () => {
    const { service, list, findUnique } = setup();
    const result = await service.list({ limit: 1, search: 'Đà Nẵng' });
    expect(result.mode).toBe('DISCOVERY');
    expect(result.items.map(({ hotel }) => hotel.id)).toEqual([topRated.id]);
    expect(findUnique).not.toHaveBeenCalled();
    expect(list).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledWith({ search: 'Đà Nẵng' });
  });

  it('uses the current account and explains price, amenity and area matches', async () => {
    const { service, list, findUnique } = setup();
    const result = await service.list({}, actor);
    expect(result.mode).toBe('PERSONALIZED');
    expect(result.items[0].hotel.id).toBe(preferred.id);
    expect(result.items[0].reasons).toEqual([
      'Giá phòng từ phù hợp với ngân sách đã chọn',
      'Có tiện nghi bạn chọn: Hồ bơi',
      'Phù hợp khu vực bạn chọn: Giáp biển',
    ]);
    expect(result.items[1].reasons).toEqual([
      'Xếp hạng theo điểm và số lượt đánh giá',
    ]);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: actor.id } }),
    );
    expect(list).toHaveBeenCalledTimes(1);
  });
});
