import { PrismaService } from '../../infrastructure/database/prisma.service';
import { NearbyPlacesService } from './nearby-places.service';
import { OpenStreetMapPlacesProvider } from './openstreetmap-places.provider';

const HOTEL = {
  id: 'hotel-1',
  name: 'Khách sạn Biển Xanh',
  latitude: '16.0611',
  longitude: '108.2277',
};

function cachedPlace(expiresAt: Date) {
  return {
    id: 'place-1',
    hotelId: HOTEL.id,
    provider: 'OPENSTREETMAP',
    providerPlaceId: 'node/1',
    name: 'Bãi biển Mỹ Khê',
    address: 'Sơn Trà, Đà Nẵng, Việt Nam',
    category: 'BEACH',
    latitude: '16.0590',
    longitude: '108.2470',
    distanceMeters: 2100,
    sourceUrl: 'https://www.openstreetmap.org/node/1',
    attribution: '© OpenStreetMap contributors',
    fetchedAt: new Date('2026-11-18T00:00:00.000Z'),
    expiresAt,
  };
}

describe('NearbyPlacesService', () => {
  it('uses a fresh cache and filters by category without calling the provider', async () => {
    const provider = { nearby: jest.fn() };
    const prisma = {
      hotel: { findFirst: jest.fn().mockResolvedValue(HOTEL) },
      nearbyPlaceCache: {
        findMany: jest
          .fn()
          .mockResolvedValue([cachedPlace(new Date(Date.now() + 60_000))]),
      },
    };
    const service = new NearbyPlacesService(
      prisma as unknown as PrismaService,
      provider as unknown as OpenStreetMapPlacesProvider,
    );

    const result = await service.list(HOTEL.id, {
      category: 'BEACH',
      limit: 1,
    });

    expect(provider.nearby).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        source: 'CACHE',
        stale: false,
        items: [expect.objectContaining({ name: 'Bãi biển Mỹ Khê' })],
      }),
    );
    expect(result.groups[0]).toEqual(
      expect.objectContaining({ category: 'BEACH', label: 'Bãi biển' }),
    );
  });

  it('keeps stale cache data when the external provider is unavailable', async () => {
    const provider = {
      nearby: jest.fn().mockRejectedValue(new Error('provider timeout')),
    };
    const prisma = {
      hotel: { findFirst: jest.fn().mockResolvedValue(HOTEL) },
      nearbyPlaceCache: {
        findMany: jest
          .fn()
          .mockResolvedValue([cachedPlace(new Date(Date.now() - 60_000))]),
      },
    };
    const service = new NearbyPlacesService(
      prisma as unknown as PrismaService,
      provider as unknown as OpenStreetMapPlacesProvider,
    );

    const result = await service.list(HOTEL.id, {});

    expect(result.source).toBe('UNAVAILABLE');
    expect(result.stale).toBe(true);
    expect(result.items).toHaveLength(1);
  });

  it('refreshes and persists real provider results when cache is empty', async () => {
    const provider = {
      nearby: jest.fn().mockResolvedValue([
        {
          providerPlaceId: 'node/2',
          name: 'Cầu Rồng',
          address: 'Hải Châu, Đà Nẵng, Việt Nam',
          category: 'ATTRACTION',
          latitude: 16.061,
          longitude: 108.227,
          distanceMeters: 480,
          sourceUrl: 'https://www.openstreetmap.org/node/2',
        },
      ]),
    };
    const stored = cachedPlace(new Date(Date.now() + 60_000));
    const transaction = {
      nearbyPlaceCache: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { ...stored, name: 'Cầu Rồng', category: 'ATTRACTION' },
          ]),
      },
    };
    const prisma = {
      hotel: { findFirst: jest.fn().mockResolvedValue(HOTEL) },
      nearbyPlaceCache: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest
        .fn()
        .mockImplementation(
          (callback: (client: typeof transaction) => unknown) =>
            callback(transaction),
        ),
    };
    const service = new NearbyPlacesService(
      prisma as unknown as PrismaService,
      provider as unknown as OpenStreetMapPlacesProvider,
    );

    const result = await service.list(HOTEL.id, {});

    expect(provider.nearby).toHaveBeenCalledWith(16.0611, 108.2277, 5000);
    expect(transaction.nearbyPlaceCache.createMany).toHaveBeenCalled();
    expect(result.source).toBe('PROVIDER');
    expect(result.items[0].name).toBe('Cầu Rồng');
  });
});
