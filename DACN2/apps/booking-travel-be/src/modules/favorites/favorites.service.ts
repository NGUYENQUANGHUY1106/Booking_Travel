import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { HotelStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

const DEFAULT_WISHLIST_NAME = 'Yêu thích';

const wishlistInclude = {
  favorites: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      hotelId: true,
      createdAt: true,
      hotel: {
        select: { name: true, status: true, isVisible: true, deletedAt: true },
      },
    },
  },
} satisfies Prisma.WishlistInclude;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    await this.ensureDefault(userId);
    const wishlists = await this.prisma.wishlist.findMany({
      where: { userId },
      include: wishlistInclude,
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
    return wishlists.map((wishlist) => ({
      id: wishlist.id,
      name: wishlist.name,
      isDefault: wishlist.isDefault,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
      itemCount: wishlist.favorites.length,
      items: wishlist.favorites.map(({ hotel, ...favorite }) => ({
        ...favorite,
        hotelName: hotel.name,
        available:
          hotel.status === HotelStatus.APPROVED &&
          hotel.isVisible &&
          hotel.deletedAt === null,
      })),
    }));
  }

  async create(userId: string, name: string) {
    this.assertAllowedName(name);
    try {
      return await this.prisma.wishlist.create({
        data: { userId, name },
        include: wishlistInclude,
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async rename(userId: string, wishlistId: string, name: string) {
    this.assertAllowedName(name);
    const wishlist = await this.ownedOrThrow(userId, wishlistId);
    if (wishlist.isDefault)
      throw new ForbiddenException(
        'Không thể đổi tên danh sách Yêu thích mặc định.',
      );
    try {
      return await this.prisma.wishlist.update({
        where: { id: wishlist.id },
        data: { name },
        include: wishlistInclude,
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async removeList(userId: string, wishlistId: string) {
    const wishlist = await this.ownedOrThrow(userId, wishlistId);
    if (wishlist.isDefault)
      throw new ForbiddenException(
        'Không thể xóa danh sách Yêu thích mặc định.',
      );
    await this.prisma.wishlist.delete({ where: { id: wishlist.id } });
    return { deleted: true };
  }

  async save(userId: string, wishlistId: string, hotelId: string) {
    const wishlist = await this.ownedOrThrow(userId, wishlistId);
    const hotel = await this.prisma.hotel.findFirst({
      where: {
        id: hotelId,
        status: HotelStatus.APPROVED,
        isVisible: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!hotel)
      throw new NotFoundException(
        'Khách sạn không tồn tại hoặc không còn công khai.',
      );
    const item = await this.prisma.favorite.upsert({
      where: { wishlistId_hotelId: { wishlistId: wishlist.id, hotelId } },
      create: { wishlistId: wishlist.id, hotelId },
      update: {},
    });
    return { saved: true, item };
  }

  async unsave(userId: string, wishlistId: string, hotelId: string) {
    const wishlist = await this.ownedOrThrow(userId, wishlistId);
    await this.prisma.favorite.deleteMany({
      where: { wishlistId: wishlist.id, hotelId },
    });
    return { saved: false };
  }

  private ensureDefault(userId: string) {
    return this.prisma.wishlist.upsert({
      where: { userId_name: { userId, name: DEFAULT_WISHLIST_NAME } },
      create: { userId, name: DEFAULT_WISHLIST_NAME, isDefault: true },
      update: { isDefault: true },
    });
  }

  private async ownedOrThrow(userId: string, wishlistId: string) {
    const wishlist = await this.prisma.wishlist.findFirst({
      where: { id: wishlistId, userId },
      select: { id: true, isDefault: true },
    });
    if (!wishlist) throw new NotFoundException('Không tìm thấy wishlist.');
    return wishlist;
  }

  private assertAllowedName(name: string) {
    if (
      name.toLocaleLowerCase('vi-VN') ===
      DEFAULT_WISHLIST_NAME.toLocaleLowerCase('vi-VN')
    ) {
      throw new ConflictException(
        'Tên này dành cho danh sách Yêu thích mặc định.',
      );
    }
  }

  private rethrowDuplicate(error: unknown): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Bạn đã có wishlist với tên này.');
    }
  }
}
