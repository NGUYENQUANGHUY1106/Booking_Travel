import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateHotelDto } from './dto/create-hotel.dto';
import { HotelQueryDto } from './dto/hotel-query.dto';
import { UpdateHotelDto } from './dto/update-hotel.dto';

@Injectable()
export class HotelsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: HotelQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.HotelWhereInput = {
      deletedAt: null,
      ownerId: query.ownerId,
      status: query.status,
      city: query.city
        ? { equals: query.city.trim(), mode: 'insensitive' }
        : undefined,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { province: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };

    return this.prisma.hotel.findMany({
      where,
      include: { owner: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id, deletedAt: null },
      include: {
        owner: { select: { id: true, fullName: true, email: true } },
        rooms: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
    return hotel;
  }

  create(input: CreateHotelDto) {
    return this.prisma.hotel.create({
      data: {
        ...input,
        name: input.name.trim(),
        slug: input.slug.trim().toLowerCase(),
        addressLine: input.addressLine.trim(),
        city: input.city.trim(),
        province: input.province.trim(),
        amenities: input.amenities ?? [],
      },
    });
  }

  async update(id: string, input: UpdateHotelDto) {
    await this.get(id);
    return this.prisma.hotel.update({
      where: { id },
      data: {
        ...input,
        name: input.name?.trim(),
        slug: input.slug?.trim().toLowerCase(),
        addressLine: input.addressLine?.trim(),
        city: input.city?.trim(),
        province: input.province?.trim(),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.hotel.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
