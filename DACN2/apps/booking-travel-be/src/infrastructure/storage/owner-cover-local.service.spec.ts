import { ConfigService } from '@nestjs/config';
import { OwnerCoverLocalService } from './owner-cover-local.service';

describe('OwnerCoverLocalService URL verification', () => {
  const coverId = '4e281a42-d1a7-45c2-aa01-f7d1423d79ea';
  const service = new OwnerCoverLocalService({} as ConfigService);
  const load = jest.fn().mockResolvedValue({
    metadata: {
      userId: 'user-1',
      mimeType: 'image/png',
      sizeBytes: 8,
    },
    image: Buffer.alloc(8),
  });

  beforeAll(() => {
    Object.defineProperty(service, 'load', { value: load });
  });

  beforeEach(() => jest.clearAllMocks());

  it.each([
    `/api/owner-covers/${coverId}/content`,
    `http://192.168.1.25:3001/api/owner-covers/${coverId}/content`,
  ])('accepts a local cover URL reachable by web or phone: %s', async (url) => {
    await expect(service.verify('user-1', url)).resolves.toBeUndefined();
    expect(load).toHaveBeenCalledWith(coverId);
  });

  it('rejects a cover owned by another user', async () => {
    await expect(
      service.verify('user-2', `/api/owner-covers/${coverId}/content`),
    ).rejects.toMatchObject({ status: 403 });
  });
});
