import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdministrativeCatalogMode,
  AdministrativeLevel,
  AdministrativeUnitStatus,
  HotelMediaStatus,
  HotelStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  UpdateHotelAmenitiesDto,
  UpdateHotelLocationDto,
  SubmitHotelDto,
} from './dto/owner-hotel-wizard.dto';
import { HotelsService } from './hotels.service';

@Injectable()
export class OwnerHotelWizardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
    private readonly hotels: HotelsService,
  ) {}

  catalog() {
    return this.prisma.amenityCatalog.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  private async assertEditable(hotelId: string, user: AuthenticatedUser) {
    await this.authorization.assertHotelOwner(hotelId, user);
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, ownerId: user.id, deletedAt: null },
      select: { status: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy chỗ ở.');
    if (
      hotel.status !== HotelStatus.DRAFT &&
      hotel.status !== HotelStatus.REJECTED
    )
      throw new ConflictException(
        'Trạng thái hiện tại không cho chỉnh sửa hồ sơ.',
      );
  }

  private async updateVersioned(
    hotelId: string,
    user: AuthenticatedUser,
    expectedVersion: number,
    update: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    await this.assertEditable(hotelId, user);
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.hotel.updateMany({
        where: {
          id: hotelId,
          ownerId: user.id,
          deletedAt: null,
          profileVersion: expectedVersion,
          status: { in: [HotelStatus.DRAFT, HotelStatus.REJECTED] },
        },
        data: { profileVersion: { increment: 1 } },
      });
      if (!changed.count)
        throw new ConflictException(
          'Hồ sơ đã thay đổi. Hãy tải lại trước khi lưu.',
        );
      await update(tx);
    });
    return this.hotels.getOwnerProfile(hotelId, user);
  }

  async location(
    hotelId: string,
    user: AuthenticatedUser,
    input: UpdateHotelLocationDto,
  ) {
    const units = await this.prisma.administrativeUnit.findMany({
      where: {
        id: {
          in: [
            input.provinceUnitId,
            input.districtUnitId,
            input.wardUnitId,
          ].filter((id): id is string => Boolean(id)),
        },
        status: AdministrativeUnitStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        level: true,
        parentId: true,
        catalogMode: true,
      },
    });
    const province = units.find(
      (item) =>
        item.id === input.provinceUnitId &&
        item.level === AdministrativeLevel.PROVINCE,
    );
    const district = units.find(
      (item) =>
        item.id === input.districtUnitId &&
        item.level === AdministrativeLevel.DISTRICT &&
        item.parentId === province?.id &&
        item.catalogMode === province.catalogMode,
    );
    const ward = units.find(
      (item) =>
        item.id === input.wardUnitId &&
        item.level === AdministrativeLevel.COMMUNE &&
        item.parentId ===
          (province?.catalogMode === AdministrativeCatalogMode.CURRENT
            ? province.id
            : district?.id) &&
        item.catalogMode === province?.catalogMode,
    );
    if (
      !province ||
      !ward ||
      (province.catalogMode === AdministrativeCatalogMode.LEGACY &&
        !district) ||
      (province.catalogMode === AdministrativeCatalogMode.CURRENT &&
        input.districtUnitId)
    )
      throw new BadRequestException(
        'Địa chỉ hành chính không hợp lệ hoặc chưa có dữ liệu danh mục.',
      );
    return this.updateVersioned(
      hotelId,
      user,
      input.expectedVersion,
      async (tx) => {
        await tx.hotel.update({
          where: { id: hotelId },
          data: {
            addressLine: input.addressLine.trim(),
            province: province.name,
            city: district?.name ?? province.name,
            district: district?.name ?? null,
            ward: ward.name,
            provinceUnitId: province.id,
            districtUnitId: district?.id ?? null,
            wardUnitId: ward.id,
            latitude: input.latitude,
            longitude: input.longitude,
          },
        });
      },
    );
  }

  async amenities(
    hotelId: string,
    user: AuthenticatedUser,
    input: UpdateHotelAmenitiesDto,
  ) {
    const allowed = await this.prisma.amenityCatalog.findMany({
      where: { id: { in: input.amenityIds }, active: true },
      select: { id: true },
    });
    if (allowed.length !== input.amenityIds.length)
      throw new BadRequestException('Có tiện ích không nằm trong danh mục.');
    return this.updateVersioned(
      hotelId,
      user,
      input.expectedVersion,
      async (tx) => {
        await tx.hotelAmenity.deleteMany({ where: { hotelId } });
        if (input.amenityIds.length)
          await tx.hotelAmenity.createMany({
            data: input.amenityIds.map((amenityId) => ({ hotelId, amenityId })),
          });
        await tx.hotel.update({
          where: { id: hotelId },
          data: { amenities: input.amenityIds },
        });
      },
    );
  }

  async submit(
    hotelId: string,
    user: AuthenticatedUser,
    input: SubmitHotelDto,
  ) {
    await this.authorization.assertHotelOwner(hotelId, user);
    await this.prisma.$transaction(async (tx) => {
      const hotel = await tx.hotel.findFirst({
        where: { id: hotelId, ownerId: user.id, deletedAt: null },
        include: {
          policy: true,
          media: {
            where: { status: HotelMediaStatus.READY, deletedAt: null },
            select: { id: true, isCover: true, sortOrder: true },
          },
          rooms: { where: { deletedAt: null }, select: { id: true } },
          amenityLinks: { select: { amenityId: true } },
        },
      });
      if (!hotel) throw new NotFoundException('Không tìm thấy chỗ ở.');
      if (
        hotel.status === HotelStatus.PENDING &&
        hotel.profileVersion === input.expectedVersion + 1
      )
        return;
      if (
        hotel.status !== HotelStatus.DRAFT &&
        hotel.status !== HotelStatus.REJECTED
      )
        throw new ConflictException('Chỗ ở không ở trạng thái cho gửi duyệt.');
      if (hotel.profileVersion !== input.expectedVersion)
        throw new ConflictException(
          'Hồ sơ đã thay đổi. Hãy tải lại trước khi gửi duyệt.',
        );
      const missing = [
        !hotel.name.trim() || !hotel.accommodationType ? 'Cơ bản' : null,
        !(hotel.contactEmail || hotel.contactPhone) ||
        !hotel.checkInTime ||
        !hotel.checkOutTime
          ? 'Liên hệ và giờ nhận/trả'
          : null,
        !hotel.addressLine ||
        !hotel.provinceUnitId ||
        !hotel.wardUnitId ||
        !hotel.latitude ||
        !hotel.longitude
          ? 'Vị trí'
          : null,
        !hotel.media.some((item) => item.isCover) ? 'Ảnh bìa' : null,
        !(hotel.policy?.cancellationPolicy || hotel.policy?.houseRules)
          ? 'Chính sách'
          : null,
        hotel.rooms.length === 0 ? 'Hạng phòng' : null,
      ].filter((item): item is string => Boolean(item));
      if (missing.length)
        throw new BadRequestException({
          message: 'Hồ sơ chưa đủ điều kiện gửi duyệt.',
          missing,
        });
      const changed = await tx.hotel.updateMany({
        where: {
          id: hotelId,
          ownerId: user.id,
          deletedAt: null,
          status: hotel.status,
          profileVersion: input.expectedVersion,
        },
        data: { status: HotelStatus.PENDING, profileVersion: { increment: 1 } },
      });
      if (!changed.count) throw new ConflictException('Hồ sơ đã thay đổi.');
      await tx.hotelSubmission.create({
        data: {
          id: randomUUID(),
          hotelId,
          ownerId: user.id,
          version: input.expectedVersion + 1,
          snapshot: {
            name: hotel.name,
            accommodationType: hotel.accommodationType,
            description: hotel.description,
            addressLine: hotel.addressLine,
            province: hotel.province,
            district: hotel.district,
            ward: hotel.ward,
            latitude: hotel.latitude?.toString(),
            longitude: hotel.longitude?.toString(),
            mediaIds: hotel.media.map((item) => item.id),
            coverId: hotel.media.find((item) => item.isCover)?.id,
            amenityIds: hotel.amenityLinks.map((item) => item.amenityId),
            policy: hotel.policy
              ? {
                  cancellationPolicy: hotel.policy.cancellationPolicy,
                  houseRules: hotel.policy.houseRules,
                }
              : null,
            roomIds: hotel.rooms.map((item) => item.id),
          },
        },
      });
    });
    return this.hotels.getOwnerProfile(hotelId, user);
  }
}
