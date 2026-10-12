import { Injectable, NotFoundException } from '@nestjs/common';
import { AddressMode } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AddressCatalogService } from './address-catalog.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@Injectable()
export class AddressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: AddressCatalogService,
  ) {}

  list(ownerId: string) {
    return this.prisma.savedAddress.findMany({
      where: { ownerId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async get(ownerId: string, id: string) {
    return this.getOwnedOrThrow(ownerId, id);
  }

  async create(ownerId: string, input: CreateAddressDto) {
    const validated = await this.catalog.validate(input);
    const prepared = this.prepareAddress(input, validated);

    return this.prisma.$transaction(async (transaction) => {
      const shouldBeDefault =
        input.isDefault === true ||
        (await transaction.savedAddress.count({
          where: { ownerId, deletedAt: null },
        })) === 0;
      if (shouldBeDefault) {
        await transaction.savedAddress.updateMany({
          where: { ownerId, deletedAt: null },
          data: { isDefault: false },
        });
      }
      return transaction.savedAddress.create({
        data: { ownerId, ...prepared, isDefault: shouldBeDefault },
      });
    });
  }

  async update(ownerId: string, id: string, input: UpdateAddressDto) {
    const existing = await this.getOwnedOrThrow(ownerId, id);
    const nextMode = input.mode ?? existing.mode;
    const communeChanged =
      input.communeUnitId !== undefined &&
      input.communeUnitId !== existing.communeUnitId;
    const merged: CreateAddressDto = {
      mode: nextMode,
      provinceUnitId: input.provinceUnitId ?? existing.provinceUnitId,
      districtUnitId:
        nextMode === AddressMode.CURRENT
          ? undefined
          : input.districtUnitId === undefined
            ? (existing.districtUnitId ?? undefined)
            : input.districtUnitId,
      communeUnitId: input.communeUnitId ?? existing.communeUnitId,
      streetId: communeChanged
        ? input.streetId
        : input.streetId === undefined
          ? (existing.streetId ?? undefined)
          : input.streetId,
      label:
        input.label === undefined ? (existing.label ?? undefined) : input.label,
      streetText:
        input.streetText === undefined
          ? (existing.streetText ?? undefined)
          : input.streetText,
      addressLine: input.addressLine ?? existing.addressLine,
      postalCode:
        input.postalCode === undefined
          ? (existing.postalCode ?? undefined)
          : input.postalCode,
      latitude:
        input.latitude === undefined
          ? existing.latitude?.toNumber()
          : input.latitude,
      longitude:
        input.longitude === undefined
          ? existing.longitude?.toNumber()
          : input.longitude,
      isDefault: input.isDefault ?? existing.isDefault,
    };
    const validated = await this.catalog.validate(merged);
    const prepared = this.prepareAddress(merged, validated);

    return this.prisma.$transaction(async (transaction) => {
      if (merged.isDefault) {
        await transaction.savedAddress.updateMany({
          where: { ownerId, deletedAt: null, NOT: { id } },
          data: { isDefault: false },
        });
      }
      return transaction.savedAddress.update({
        where: { id },
        data: { ...prepared, isDefault: merged.isDefault },
      });
    });
  }

  async remove(ownerId: string, id: string) {
    const existing = await this.getOwnedOrThrow(ownerId, id);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.savedAddress.update({
        where: { id },
        data: { deletedAt: new Date(), isDefault: false },
      });
      if (existing.isDefault) {
        const replacement = await transaction.savedAddress.findFirst({
          where: { ownerId, deletedAt: null, NOT: { id } },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        });
        if (replacement) {
          await transaction.savedAddress.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
        }
      }
    });
  }

  async setDefault(ownerId: string, id: string) {
    await this.getOwnedOrThrow(ownerId, id);
    return this.prisma.$transaction(async (transaction) => {
      await transaction.savedAddress.updateMany({
        where: { ownerId, deletedAt: null },
        data: { isDefault: false },
      });
      return transaction.savedAddress.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }

  private async getOwnedOrThrow(ownerId: string, id: string) {
    const address = await this.prisma.savedAddress.findFirst({
      where: { id, ownerId, deletedAt: null },
    });
    if (!address) throw new NotFoundException('Address not found.');
    return address;
  }

  private prepareAddress(
    input: CreateAddressDto,
    validated: Awaited<ReturnType<AddressCatalogService['validate']>>,
  ) {
    const streetName = validated.street?.name ?? input.streetText?.trim();
    const segments = [
      input.addressLine.trim(),
      streetName,
      validated.commune.name,
      validated.district?.name,
      validated.province.name,
      'Việt Nam',
    ].filter(Boolean);

    return {
      mode: input.mode,
      countryCode: 'VN',
      provinceUnitId: validated.province.id,
      districtUnitId: validated.district?.id,
      communeUnitId: validated.commune.id,
      streetId: validated.street?.id,
      label: input.label?.trim(),
      streetText: input.streetText?.trim(),
      addressLine: input.addressLine.trim(),
      postalCode: input.postalCode?.trim(),
      latitude: input.latitude,
      longitude: input.longitude,
      formattedAddress: segments.join(', '),
      administrativeSnapshot: {
        province: this.snapshotUnit(validated.province),
        district: validated.district
          ? this.snapshotUnit(validated.district)
          : null,
        commune: this.snapshotUnit(validated.commune),
        street: validated.street
          ? { id: validated.street.id, name: validated.street.name }
          : null,
      },
      datasetVersion: validated.datasetVersion,
    };
  }

  private snapshotUnit(unit: {
    id: string;
    officialCode: string;
    name: string;
  }) {
    return { id: unit.id, officialCode: unit.officialCode, name: unit.name };
  }
}
