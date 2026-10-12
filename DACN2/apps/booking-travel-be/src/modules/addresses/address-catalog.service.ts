import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AddressMode,
  AdministrativeCatalogMode,
  AdministrativeLevel,
  AdministrativeUnitStatus,
} from '@prisma/client';
import { normalizeVietnameseSearch } from '../../common/utils/vietnamese-search';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  SearchCatalogQueryDto,
  StreetSearchQueryDto,
} from './dto/catalog-query.dto';
import { ValidateAddressDto } from './dto/validate-address.dto';

@Injectable()
export class AddressCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listProvinces(mode: AdministrativeCatalogMode) {
    return this.listUnits(mode, AdministrativeLevel.PROVINCE, null);
  }

  listCurrentCommunes(provinceId: string) {
    return this.listUnits(
      AdministrativeCatalogMode.CURRENT,
      AdministrativeLevel.COMMUNE,
      provinceId,
    );
  }

  listLegacyDistricts(provinceId: string) {
    return this.listUnits(
      AdministrativeCatalogMode.LEGACY,
      AdministrativeLevel.DISTRICT,
      provinceId,
    );
  }

  listLegacyCommunes(districtId: string) {
    return this.listUnits(
      AdministrativeCatalogMode.LEGACY,
      AdministrativeLevel.COMMUNE,
      districtId,
    );
  }

  private listUnits(
    mode: AdministrativeCatalogMode,
    level: AdministrativeLevel,
    parentId: string | null,
  ) {
    return this.prisma.administrativeUnit.findMany({
      where: {
        catalogMode: mode,
        level,
        parentId,
        status: AdministrativeUnitStatus.ACTIVE,
      },
      select: this.unitSelect(),
      orderBy: [{ name: 'asc' }],
    });
  }

  search(query: SearchCatalogQueryDto) {
    const normalized = normalizeVietnameseSearch(query.q);
    return this.prisma.administrativeUnit.findMany({
      where: {
        catalogMode: query.mode,
        status: AdministrativeUnitStatus.ACTIVE,
        level: query.level,
        parentId: query.parentId,
        OR: [
          { officialCode: { startsWith: query.q } },
          { normalizedName: { contains: normalized } },
          { aliases: { some: { normalizedName: { contains: normalized } } } },
        ],
      },
      select: {
        ...this.unitSelect(),
        parent: { select: { id: true, officialCode: true, name: true } },
      },
      take: query.limit,
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
    });
  }

  searchStreets(query: StreetSearchQueryDto) {
    const normalized = normalizeVietnameseSearch(query.q);
    return this.prisma.street.findMany({
      where: {
        normalizedName: { contains: normalized },
        administrativeUnits: {
          some: { administrativeUnitId: query.communeId },
        },
      },
      select: { id: true, officialCode: true, name: true },
      take: query.limit,
      orderBy: { name: 'asc' },
    });
  }

  async getTransitions(unitId: string) {
    const unit = await this.prisma.administrativeUnit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });
    if (!unit) throw new NotFoundException('Administrative unit not found.');

    return this.prisma.administrativeTransition.findMany({
      where: { fromUnitId: unitId },
      include: {
        toUnit: { select: this.unitSelect() },
        source: { select: { name: true, url: true, version: true } },
      },
    });
  }

  async validate(input: ValidateAddressDto) {
    const mode =
      input.mode === AddressMode.CURRENT
        ? AdministrativeCatalogMode.CURRENT
        : AdministrativeCatalogMode.LEGACY;

    const [province, district, commune, street] = await Promise.all([
      this.prisma.administrativeUnit.findUnique({
        where: { id: input.provinceUnitId },
        include: { source: { select: { version: true } } },
      }),
      input.districtUnitId
        ? this.prisma.administrativeUnit.findUnique({
            where: { id: input.districtUnitId },
          })
        : null,
      this.prisma.administrativeUnit.findUnique({
        where: { id: input.communeUnitId },
      }),
      input.streetId
        ? this.prisma.street.findUnique({
            where: { id: input.streetId },
            include: {
              administrativeUnits: {
                where: { administrativeUnitId: input.communeUnitId },
              },
            },
          })
        : null,
    ]);

    if (
      !province ||
      province.level !== AdministrativeLevel.PROVINCE ||
      province.catalogMode !== mode ||
      province.status !== AdministrativeUnitStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Province is invalid for the selected catalog.',
      );
    }
    if (
      !commune ||
      commune.level !== AdministrativeLevel.COMMUNE ||
      commune.catalogMode !== mode ||
      commune.status !== AdministrativeUnitStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Commune is invalid for the selected catalog.',
      );
    }

    if (mode === AdministrativeCatalogMode.CURRENT) {
      if (input.districtUnitId) {
        throw new BadRequestException(
          'Current addresses must not contain a district.',
        );
      }
      if (commune.parentId !== province.id) {
        throw new BadRequestException(
          'Commune does not belong to the selected province.',
        );
      }
    } else if (
      !district ||
      district.level !== AdministrativeLevel.DISTRICT ||
      district.catalogMode !== mode ||
      district.parentId !== province.id ||
      commune.parentId !== district.id
    ) {
      throw new BadRequestException(
        'Legacy district/commune hierarchy is invalid.',
      );
    }

    if (
      input.streetId &&
      (!street || street.administrativeUnits.length === 0)
    ) {
      throw new BadRequestException(
        'Street is not linked to the selected commune.',
      );
    }

    return {
      province,
      district,
      commune,
      street,
      datasetVersion: province.source.version,
    };
  }

  private unitSelect() {
    return {
      id: true,
      officialCode: true,
      name: true,
      level: true,
      unitType: true,
      catalogMode: true,
      validFrom: true,
      validTo: true,
    } as const;
  }
}
