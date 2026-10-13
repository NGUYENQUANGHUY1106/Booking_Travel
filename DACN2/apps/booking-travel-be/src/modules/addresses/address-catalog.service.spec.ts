import { BadRequestException } from '@nestjs/common';
import {
  AddressMode,
  AdministrativeCatalogMode,
  AdministrativeLevel,
  AdministrativeUnitStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AddressCatalogService } from './address-catalog.service';

describe('AddressCatalogService', () => {
  const findUnique = jest.fn();
  const prisma = {
    administrativeUnit: { findUnique },
    street: { findUnique: jest.fn() },
  } as unknown as PrismaService;
  const service = new AddressCatalogService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('accepts a current two-level hierarchy', async () => {
    findUnique
      .mockResolvedValueOnce({
        id: 'p1',
        level: AdministrativeLevel.PROVINCE,
        catalogMode: AdministrativeCatalogMode.CURRENT,
        status: AdministrativeUnitStatus.ACTIVE,
        source: { version: '2025-07-01' },
      })
      .mockResolvedValueOnce({
        id: 'c1',
        parentId: 'p1',
        level: AdministrativeLevel.COMMUNE,
        catalogMode: AdministrativeCatalogMode.CURRENT,
        status: AdministrativeUnitStatus.ACTIVE,
      });

    const result = await service.validate({
      mode: AddressMode.CURRENT,
      provinceUnitId: 'p1',
      communeUnitId: 'c1',
    });
    expect(result.datasetVersion).toBe('2025-07-01');
  });

  it('rejects a current commune under another province', async () => {
    findUnique
      .mockResolvedValueOnce({
        id: 'p1',
        level: AdministrativeLevel.PROVINCE,
        catalogMode: AdministrativeCatalogMode.CURRENT,
        status: AdministrativeUnitStatus.ACTIVE,
        source: { version: '2025-07-01' },
      })
      .mockResolvedValueOnce({
        id: 'c1',
        parentId: 'p2',
        level: AdministrativeLevel.COMMUNE,
        catalogMode: AdministrativeCatalogMode.CURRENT,
        status: AdministrativeUnitStatus.ACTIVE,
      });

    await expect(
      service.validate({
        mode: AddressMode.CURRENT,
        provinceUnitId: 'p1',
        communeUnitId: 'c1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a district for a legacy address', async () => {
    findUnique
      .mockResolvedValueOnce({
        id: 'p1',
        level: AdministrativeLevel.PROVINCE,
        catalogMode: AdministrativeCatalogMode.LEGACY,
        status: AdministrativeUnitStatus.ACTIVE,
        source: { version: '2025-06-30' },
      })
      .mockResolvedValueOnce({
        id: 'c1',
        parentId: 'd1',
        level: AdministrativeLevel.COMMUNE,
        catalogMode: AdministrativeCatalogMode.LEGACY,
        status: AdministrativeUnitStatus.ACTIVE,
      });

    await expect(
      service.validate({
        mode: AddressMode.LEGACY,
        provinceUnitId: 'p1',
        communeUnitId: 'c1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
