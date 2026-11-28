import { BadRequestException, Injectable } from '@nestjs/common';
import { HotelStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { HotelStaySearchQueryDto } from '../hotels/dto/hotel-stay-search-query.dto';

const MAX_ENTRIES = 50;
const publicHotel = {
  status: HotelStatus.APPROVED,
  isVisible: true,
  deletedAt: null,
};
const latestSearch = [
  { searchedAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.HotelSearchHistoryOrderByWithRelationInput[];
const latestView = [
  { viewedAt: 'desc' },
  { hotelId: 'desc' },
] satisfies Prisma.HotelViewHistoryOrderByWithRelationInput[];

@Injectable()
export class TravelHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async lockConsent(tx: Prisma.TransactionClient, userId: string) {
    const [user] = await tx.$queryRaw<{ travelHistoryEnabled: boolean }[]>`
      SELECT "travelHistoryEnabled" FROM "User" WHERE id = ${userId} FOR UPDATE
    `;
    return user?.travelHistoryEnabled ?? false;
  }

  async get(userId: string) {
    const [user, searches, hotels] = await this.prisma.$transaction(
      [
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { travelHistoryEnabled: true },
        }),
        this.prisma.hotelSearchHistory.findMany({
          where: { userId },
          orderBy: latestSearch,
          take: MAX_ENTRIES,
          select: { id: true, criteria: true, searchedAt: true },
        }),
        this.prisma.hotelViewHistory.findMany({
          where: { userId, hotel: publicHotel },
          orderBy: latestView,
          take: MAX_ENTRIES,
          select: {
            hotelId: true,
            viewCount: true,
            viewedAt: true,
            hotel: { select: { name: true } },
          },
        }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return {
      enabled: user.travelHistoryEnabled,
      searches: user.travelHistoryEnabled ? searches : [],
      hotels: user.travelHistoryEnabled
        ? hotels.map(({ hotel, ...entry }) => ({
            ...entry,
            hotelName: hotel.name,
          }))
        : [],
    };
  }

  async consent(userId: string, enabled: boolean) {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { travelHistoryEnabled: enabled },
      });
      if (!enabled) {
        await tx.hotelSearchHistory.deleteMany({ where: { userId } });
        await tx.hotelViewHistory.deleteMany({ where: { userId } });
      }
    });
    return { enabled };
  }

  async recordSearch(userId: string, input: HotelStaySearchQueryDto) {
    if (
      input.checkOut <= input.checkIn ||
      (input.minPrice ?? 0) > (input.maxPrice ?? Infinity)
    ) {
      throw new BadRequestException(
        'Điều kiện lưu trú hoặc khoảng giá không hợp lệ.',
      );
    }
    const criteria = {
      destination: input.destination.trim(),
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: input.children,
      rooms: input.rooms,
      minPrice: input.minPrice ?? 0,
      maxPrice: input.maxPrice ?? null,
      stars: [...new Set(input.stars ?? [])].sort((a, b) => a - b),
      minReviewScore: input.minReviewScore ?? 0,
      propertyTypes: [...new Set(input.propertyTypes ?? [])].sort(),
      amenities: [...new Set(input.amenities ?? [])].sort(),
      freeCancellation: input.freeCancellation ?? false,
      sort: input.sort ?? 'recommended',
    };
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          ...criteria,
          destination: criteria.destination.toLocaleLowerCase('vi-VN'),
        }),
      )
      .digest('hex');
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.lockConsent(tx, userId))) return { recorded: false };
      await tx.hotelSearchHistory.upsert({
        where: { userId_fingerprint: { userId, fingerprint } },
        create: { userId, fingerprint, criteria },
        update: { criteria, searchedAt: new Date() },
      });
      const excess = await tx.hotelSearchHistory.findMany({
        where: { userId },
        orderBy: latestSearch,
        skip: MAX_ENTRIES,
        select: { id: true },
      });
      if (excess.length)
        await tx.hotelSearchHistory.deleteMany({
          where: { userId, id: { in: excess.map(({ id }) => id) } },
        });
      return { recorded: true };
    });
  }

  async recordHotel(userId: string, hotelId: string) {
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.lockConsent(tx, userId))) return { recorded: false };
      const hotel = await tx.hotel.findFirst({
        where: { id: hotelId, ...publicHotel },
        select: { id: true },
      });
      if (!hotel) return { recorded: false };
      await tx.hotelViewHistory.upsert({
        where: { userId_hotelId: { userId, hotelId } },
        create: { userId, hotelId },
        update: { viewCount: { increment: 1 }, viewedAt: new Date() },
      });
      const excess = await tx.hotelViewHistory.findMany({
        where: { userId },
        orderBy: latestView,
        skip: MAX_ENTRIES,
        select: { hotelId: true },
      });
      if (excess.length)
        await tx.hotelViewHistory.deleteMany({
          where: {
            userId,
            hotelId: { in: excess.map((entry) => entry.hotelId) },
          },
        });
      return { recorded: true };
    });
  }

  async deleteSearch(userId: string, id: string) {
    const { count } = await this.prisma.hotelSearchHistory.deleteMany({
      where: { userId, id },
    });
    return { removed: count };
  }

  async deleteHotel(userId: string, hotelId: string) {
    const { count } = await this.prisma.hotelViewHistory.deleteMany({
      where: { userId, hotelId },
    });
    return { removed: count };
  }

  async clear(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lockConsent(tx, userId);
      await tx.hotelSearchHistory.deleteMany({ where: { userId } });
      await tx.hotelViewHistory.deleteMany({ where: { userId } });
    });
    return { cleared: true };
  }
}
