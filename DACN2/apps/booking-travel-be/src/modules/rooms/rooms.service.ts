import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async listByHotel(hotelId: string) {
    await this.assertHotelExists(hotelId);
    return this.prisma.room.findMany({
      where: { hotelId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null },
      include: { hotel: { select: { id: true, name: true, ownerId: true } } },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng.');
    return room;
  }

  async create(hotelId: string, input: CreateRoomDto) {
    await this.assertHotelExists(hotelId);
    return this.prisma.room.create({
      data: {
        ...input,
        hotelId,
        name: input.name.trim(),
        type: input.type.trim().toUpperCase(),
        bedInfo: input.bedInfo.trim(),
        currency: input.currency?.trim().toUpperCase() ?? 'VND',
        amenities: input.amenities ?? [],
      },
    });
  }

  async update(id: string, input: UpdateRoomDto) {
    await this.get(id);
    return this.prisma.room.update({
      where: { id },
      data: {
        ...input,
        name: input.name?.trim(),
        type: input.type?.trim().toUpperCase(),
        bedInfo: input.bedInfo?.trim(),
        currency: input.currency?.trim().toUpperCase(),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.prisma.room.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async assertHotelExists(hotelId: string): Promise<void> {
    const hotel = await this.prisma.hotel.findFirst({
      where: { id: hotelId, deletedAt: null },
      select: { id: true },
    });
    if (!hotel) throw new NotFoundException('Không tìm thấy khách sạn.');
  }
}
