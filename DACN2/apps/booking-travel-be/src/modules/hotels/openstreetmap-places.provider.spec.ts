import {
  OpenStreetMapPlacesProvider,
  distanceMetersBetween,
} from './openstreetmap-places.provider';

describe('distanceMetersBetween', () => {
  it('calculates a stable geodesic distance in metres', () => {
    expect(
      distanceMetersBetween(16.0611, 108.2277, 16.0611, 108.2377),
    ).toBeGreaterThan(1_000);
    expect(
      distanceMetersBetween(16.0611, 108.2277, 16.0611, 108.2377),
    ).toBeLessThan(1_100);
    expect(distanceMetersBetween(16.0611, 108.2277, 16.0611, 108.2277)).toBe(0);
  });
});

describe('OpenStreetMapPlacesProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('deduplicates real OpenStreetMap features returned by category searches', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                osm_type: 'N',
                osm_id: 123,
                osm_key: 'tourism',
                osm_value: 'attraction',
                name: 'Cầu Rồng',
                district: 'Hải Châu',
                city: 'Đà Nẵng',
                country: 'Việt Nam',
              },
              geometry: { coordinates: [108.2278, 16.0612] },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await new OpenStreetMapPlacesProvider().nearby(
      16.0611,
      108.2277,
      5_000,
    );

    expect(request).toHaveBeenCalledTimes(7);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        providerPlaceId: 'node/123',
        address: 'Hải Châu, Đà Nẵng, Việt Nam',
        sourceUrl: 'https://www.openstreetmap.org/node/123',
      }),
    );
  });
});
